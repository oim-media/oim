/**
 * @license
 * Copyright (c) 2026 Xue Studios LLC
 * SPDX-License-Identifier: Apache-2.0
 */
package media.oim.sdk.crypto

import media.oim.sdk.model.OimContract
import media.oim.sdk.model.OimDocument
import media.oim.sdk.model.OimVerificationReport
import media.oim.sdk.model.ReeditPermission
import media.oim.sdk.model.ResolvedTextResult
import media.oim.sdk.model.SecurityStatus
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.math.BigDecimal
import java.math.BigInteger
import java.math.RoundingMode
import java.security.AlgorithmParameters
import java.security.KeyFactory
import java.security.KeyPair
import java.security.KeyPairGenerator
import java.security.PublicKey
import java.security.Signature
import java.security.spec.ECGenParameterSpec
import java.security.spec.ECParameterSpec
import java.security.spec.ECPoint
import java.security.spec.ECPublicKeySpec
import java.time.Instant
import java.util.concurrent.ConcurrentHashMap

/**
 * Cryptographic verifier, 7-rule canonical JSON serializer, JWK ECDSA P-256 keyring,
 * dynamic color palette resolver, and multilingual resolver aligned 1:1 with `@oim-media/core`
 * and `@oim-media/player-oim`.
 */
object OimCanonicalizerAndVerifier {

    /**
     * Rule 2 of `@oim-media/core/canonical.ts`:
     * Strict exclusion ONLY at the root of: `'signature'`, `'key_version'`, `'timestamp'`, `'creator_user_id'`.
     */
    private val ROOT_EXCLUSIONS = setOf("signature", "key_version", "timestamp", "creator_user_id")

    /**
     * Allowed dynamic color roles from `@oim-media/core/dynamic-colors.ts`.
     */
    val DYNAMIC_COLOR_ROLES = setOf(
        "primary",
        "on-primary",
        "secondary",
        "on-secondary",
        "surface",
        "on-surface",
        "outline",
        "accent",
        "text-primary",
        "text-secondary",
        "text-muted",
        "text-on-accent"
    )

    private const val CLOCK_SKEW_MS = 7L * 24L * 60L * 60L * 1000L

    data class TrustedKeyEntry(
        val keyId: String,
        val publicKey: PublicKey,
        val notAfterIso: String? = null,
        val verifyUntilIso: String? = null,
        val expiresAtEpochSec: Long? = null,
        val isEmbedded: Boolean = false
    )

    private val trustedPublicKeys = ConcurrentHashMap<String, TrustedKeyEntry>()

    init {
        // Embedded fallback public keys matching `@oim-media/player-oim/src/render/keys.ts` (`EMBEDDED_KEYS`)
        // so real `.oim.png` files verify offline even before hitting `api.oim.media/v1/media/keys`.
        registerTrustedJwk(
            keyId = "v1",
            xBase64Url = "5Qavr4M_npVognquI5k5D9K8wcXBXM9Z0mZHjqyehAs",
            yBase64Url = "oh7rz5Q7SlZT_ms2buyOw0bPX77QsXimc0X92Ymj2_o",
            isEmbedded = true
        )
        registerTrustedJwk(
            keyId = "v2",
            xBase64Url = "pRSLtFHe9p8sR8jyqP5eoaBGbHdJgjjrdClda2lNp4A",
            yBase64Url = "oopYYhgja8m2iAlSMPigeWw-F72KJLNCRFQzlyWdt2I",
            isEmbedded = true
        )
    }

    // Lazily generated local ECDSA P-256 keypair used only for unit tests & local re-signing exports.
    private val localAuthorityKeyPair: KeyPair by lazy {
        val generator = KeyPairGenerator.getInstance("EC")
        generator.initialize(ECGenParameterSpec("secp256r1"))
        val pair = generator.generateKeyPair()
        trustedPublicKeys["oim-local-test-key"] = TrustedKeyEntry("oim-local-test-key", pair.public, isEmbedded = true)
        pair
    }

    fun getLocalAuthorityKeyPair(): Pair<String, KeyPair> {
        val kp = localAuthorityKeyPair
        return "oim-local-test-key" to kp
    }

    fun registerTrustedPublicKey(
        keyId: String,
        publicKey: PublicKey,
        expiresAtEpochSec: Long? = null,
        notAfterIso: String? = null,
        verifyUntilIso: String? = null,
        isEmbedded: Boolean = false
    ) {
        val existing = trustedPublicKeys[keyId]
        // Keep earliest retirement window between embedded & server-published keys
        val mergedNotAfter = pickEarliestIso(existing?.notAfterIso, notAfterIso)
        val mergedVerifyUntil = pickEarliestIso(existing?.verifyUntilIso, verifyUntilIso)
        trustedPublicKeys[keyId] = TrustedKeyEntry(
            keyId = keyId,
            publicKey = publicKey,
            notAfterIso = mergedNotAfter,
            verifyUntilIso = mergedVerifyUntil,
            expiresAtEpochSec = expiresAtEpochSec ?: existing?.expiresAtEpochSec,
            isEmbedded = isEmbedded && (existing?.isEmbedded ?: true)
        )
    }

    /**
     * Parses and registers an ECDSA P-256 public key in JWK format from `GET https://api.oim.media/v1/media/keys`.
     */
    fun registerTrustedJwk(
        keyId: String,
        xBase64Url: String,
        yBase64Url: String,
        expiresAtEpochSec: Long? = null,
        notAfterIso: String? = null,
        verifyUntilIso: String? = null,
        isEmbedded: Boolean = false
    ): Boolean {
        return try {
            val xBytes = Base64Codec.decodeUrl(xBase64Url)
            val yBytes = Base64Codec.decodeUrl(yBase64Url)
            val point = ECPoint(BigInteger(1, xBytes), BigInteger(1, yBytes))
            val params = AlgorithmParameters.getInstance("EC").apply {
                init(ECGenParameterSpec("secp256r1"))
            }
            val ecSpec = params.getParameterSpec(ECParameterSpec::class.java)
            val pubKey = KeyFactory.getInstance("EC").generatePublic(ECPublicKeySpec(point, ecSpec))
            registerTrustedPublicKey(
                keyId = keyId,
                publicKey = pubKey,
                expiresAtEpochSec = expiresAtEpochSec,
                notAfterIso = notAfterIso,
                verifyUntilIso = verifyUntilIso,
                isEmbedded = isEmbedded
            )
            true
        } catch (_: Exception) {
            false
        }
    }

    fun trustedKeyCount(): Int = trustedPublicKeys.size

    fun trustedKeyIds(): Set<String> = trustedPublicKeys.keys.toSet()

    /**
     * Checks recursively whether any numeric value exceeds `±(2^53 - 1)` or is NaN/Infinite.
     */
    fun hasNumberOutOfRange(value: Any?): Boolean {
        return when (value) {
            is JSONObject -> {
                val keys = value.keys()
                while (keys.hasNext()) {
                    if (hasNumberOutOfRange(value.opt(keys.next()))) return true
                }
                false
            }
            is JSONArray -> {
                for (i in 0 until value.length()) {
                    if (hasNumberOutOfRange(value.opt(i))) return true
                }
                false
            }
            is Number -> {
                val d = value.toDouble()
                d.isNaN() || d.isInfinite() || kotlin.math.abs(d) > OimContract.MAX_SAFE_INTEGER
            }
            else -> false
        }
    }

    /**
     * Implements the 7 normative rules of `@oim-media/core/canonical.ts`:
     * 1. Deserialized base metadata object.
     * 2. Strict exclusion at the root ONLY of `'signature'`, `'key_version'`, `'timestamp'`, `'creator_user_id'`.
     * 3. Numeric normalization: integer-valued floats -> integers (`2.0` -> `2`, `-0.0` -> `0`); others rounded to 6 decimals.
     * 4. Recursive lexical key ordering by Unicode code point (inside objects and arrays).
     * 5. Compact serialization without whitespace around separators.
     * 6. Non-ASCII UTF-8 characters emitted directly without `\uXXXX` escaping.
     * 7. UTF-8 bytes.
     */
    fun canonicalJson(root: JSONObject): String {
        val sb = StringBuilder(512)
        writeCanonicalValue(root, isRoot = true, sb = sb)
        return sb.toString()
    }

    fun serializeCanonicalBytes(root: JSONObject): ByteArray {
        return canonicalJson(root).toByteArray(Charsets.UTF_8)
    }

    private fun writeCanonicalValue(value: Any?, isRoot: Boolean, sb: StringBuilder) {
        when (value) {
            null, JSONObject.NULL -> sb.append("null")
            is Boolean -> sb.append(if (value) "true" else "false")
            is Number -> sb.append(formatCanonicalNumber(value))
            is String -> appendUnescapedJsonString(value, sb)
            is JSONObject -> {
                val sortedKeys = buildList {
                    val iter = value.keys()
                    while (iter.hasNext()) {
                        val k = iter.next()
                        if (!isRoot || k !in ROOT_EXCLUSIONS) add(k)
                    }
                }.sortedWith { a, b -> compareByCodePoint(a, b) }

                sb.append('{')
                sortedKeys.forEachIndexed { idx, key ->
                    if (idx > 0) sb.append(',')
                    appendUnescapedJsonString(key, sb)
                    sb.append(':')
                    writeCanonicalValue(value.opt(key), isRoot = false, sb = sb)
                }
                sb.append('}')
            }
            is JSONArray -> {
                sb.append('[')
                for (i in 0 until value.length()) {
                    if (i > 0) sb.append(',')
                    writeCanonicalValue(value.opt(i), isRoot = false, sb = sb)
                }
                sb.append(']')
            }
            else -> appendUnescapedJsonString(value.toString(), sb)
        }
    }

    private fun formatCanonicalNumber(number: Number): String {
        if (number is Int || number is Long || number is Short || number is Byte) {
            return number.toLong().toString()
        }
        val d = number.toDouble()
        if (!d.isFinite()) return "null"
        if (d == 0.0) return "0" // Normalizes -0.0 to 0
        // Round the exact binary value, as JS toFixed(6) does: valueOf(d) rounds the
        // shortest decimal string instead and flips ties such as 0.1234565 the wrong way.
        val bd = BigDecimal(d)
            .setScale(OimContract.CANONICAL_MAX_DECIMALS, RoundingMode.HALF_UP)
            .stripTrailingZeros()
        if (bd.compareTo(BigDecimal.ZERO) == 0) return "0"
        return if (bd.scale() <= 0) {
            bd.toBigInteger().toString()
        } else {
            bd.toPlainString()
        }
    }

    private fun compareByCodePoint(a: String, b: String): Int {
        var i = 0
        var j = 0
        while (i < a.length && j < b.length) {
            val cpA = a.codePointAt(i)
            val cpB = b.codePointAt(j)
            if (cpA != cpB) return cpA.compareTo(cpB)
            i += Character.charCount(cpA)
            j += Character.charCount(cpB)
        }
        return a.length.compareTo(b.length)
    }

    private fun appendUnescapedJsonString(str: String, sb: StringBuilder) {
        sb.append('"')
        for (ch in str) {
            when (ch) {
                '"' -> sb.append("\\\"")
                '\\' -> sb.append("\\\\")
                '\b' -> sb.append("\\b")
                '\u000C' -> sb.append("\\f")
                '\n' -> sb.append("\\n")
                '\r' -> sb.append("\\r")
                '\t' -> sb.append("\\t")
                else -> {
                    if (ch.code < 0x20) {
                        sb.append(String.format("\\u%04x", ch.code))
                    } else {
                        sb.append(ch)
                    }
                }
            }
        }
        sb.append('"')
    }

    fun signCanonicalPayload(canonicalJson: String, keyPair: KeyPair): String {
        val sig = Signature.getInstance("SHA256withECDSA")
        sig.initSign(keyPair.private)
        sig.update(canonicalJson.toByteArray(Charsets.UTF_8))
        return Base64Codec.encode(sig.sign())
    }

    /**
     * Verifies an extracted OIM document's canonical JSON, SHA-256 IDAT seal, and ECDSA signature
     * matching `@oim-media/player-oim/src/render/security.ts`.
     */
    fun verify(
        rawJsonObject: JSONObject,
        document: OimDocument,
        computedIdatHash: String,
        allChunkCrcsValid: Boolean,
        nowMs: Long = System.currentTimeMillis()
    ): OimVerificationReport {
        val outOfRange = hasNumberOutOfRange(rawJsonObject)
        val canonical = canonicalJson(rawJsonObject)
        val declaredHash = document.security.imageHash
        val isSha256IdatAlg = document.security.imageHashAlg == OimContract.IMAGE_HASH_ALG_SHA256_IDAT
        val hashMatches = declaredHash.isNotBlank() && declaredHash.equals(computedIdatHash, ignoreCase = true)

        if (!allChunkCrcsValid) {
            return OimVerificationReport(
                status = SecurityStatus.REFUSED_TAMPERED,
                isRefused = true,
                effectiveReeditPermission = ReeditPermission.AUTHOR_ONLY,
                imageHashMatches = false,
                signatureValid = false,
                hasOutOfRangeNumbers = outOfRange,
                keyTrustedOffline = false,
                keyExpired = false,
                computedImageHash = computedIdatHash,
                declaredImageHash = declaredHash,
                canonicalJson = canonical,
                reason = "Invalid CRC-32 in one or more PNG chunks: the file is corrupt or tampered with."
            )
        }

        if (outOfRange) {
            return OimVerificationReport(
                status = SecurityStatus.REFUSED_TAMPERED,
                isRefused = true,
                effectiveReeditPermission = ReeditPermission.AUTHOR_ONLY,
                imageHashMatches = hashMatches,
                signatureValid = false,
                hasOutOfRangeNumbers = true,
                keyTrustedOffline = false,
                keyExpired = false,
                computedImageHash = computedIdatHash,
                declaredImageHash = declaredHash,
                canonicalJson = canonical,
                reason = "Number outside the IEEE-754 safe range (> 2^53 - 1): the signature is invalid."
            )
        }

        val signatureB64 = document.security.signature
        val keyId = document.security.keyId
        if (signatureB64.isNullOrBlank()) {
            // Even if unsigned, verify image hash if explicitly sealed with sha256-idat
            if (isSha256IdatAlg && declaredHash.isNotBlank() && !hashMatches) {
                return OimVerificationReport(
                    status = SecurityStatus.REFUSED_TAMPERED,
                    isRefused = true,
                    effectiveReeditPermission = ReeditPermission.AUTHOR_ONLY,
                    imageHashMatches = false,
                    signatureValid = false,
                    hasOutOfRangeNumbers = false,
                    keyTrustedOffline = false,
                    keyExpired = false,
                    computedImageHash = computedIdatHash,
                    declaredImageHash = declaredHash,
                    canonicalJson = canonical,
                    reason = "Broken sha256-idat seal: the IDAT bytes were altered."
                )
            }
            return OimVerificationReport(
                status = SecurityStatus.UNSIGNED,
                isRefused = false,
                effectiveReeditPermission = document.security.reeditPermission,
                imageHashMatches = hashMatches,
                signatureValid = false,
                hasOutOfRangeNumbers = false,
                keyTrustedOffline = false,
                keyExpired = false,
                computedImageHash = computedIdatHash,
                declaredImageHash = declaredHash,
                canonicalJson = canonical,
                reason = "The OIM file carries no ECDSA signature."
            )
        }

        val candidateEntries = if (!keyId.isNullOrBlank()) {
            listOfNotNull(trustedPublicKeys[keyId])
        } else {
            trustedPublicKeys.values.toList()
        }

        if (candidateEntries.isEmpty()) {
            // Check sha256-idat seal even if key is not in keyring yet
            if (isSha256IdatAlg && declaredHash.isNotBlank() && !hashMatches) {
                return OimVerificationReport(
                    status = SecurityStatus.REFUSED_TAMPERED,
                    isRefused = true,
                    effectiveReeditPermission = ReeditPermission.AUTHOR_ONLY,
                    imageHashMatches = false,
                    signatureValid = false,
                    hasOutOfRangeNumbers = false,
                    keyTrustedOffline = false,
                    keyExpired = false,
                    computedImageHash = computedIdatHash,
                    declaredImageHash = declaredHash,
                    canonicalJson = canonical,
                    reason = "Broken sha256-idat seal: the IDAT bytes were altered."
                )
            }
            return OimVerificationReport(
                status = SecurityStatus.UNKNOWN_KEY,
                isRefused = false,
                effectiveReeditPermission = ReeditPermission.AUTHOR_ONLY,
                imageHashMatches = hashMatches,
                signatureValid = false,
                hasOutOfRangeNumbers = false,
                keyTrustedOffline = false,
                keyExpired = false,
                computedImageHash = computedIdatHash,
                declaredImageHash = declaredHash,
                canonicalJson = canonical,
                reason = "Public key '${keyId ?: "(no kid)"}' is not in the local keyring."
            )
        }

        val sigBytes = decodeSignatureBytes(signatureB64)
        val canonicalBytes = canonical.toByteArray(Charsets.UTF_8)
        var matchedEntry = candidateEntries.firstOrNull { entry ->
            verifyEcdsaSignature(entry.publicKey, canonicalBytes, sigBytes)
        }

        // Backward-compatibility fallback for files signed before creator_user_id was excluded
        if (matchedEntry == null && rawJsonObject.has("creator_user_id")) {
            val legacyCanonical = legacyCanonicalJson(rawJsonObject).toByteArray(Charsets.UTF_8)
            matchedEntry = candidateEntries.firstOrNull { entry ->
                verifyEcdsaSignature(entry.publicKey, legacyCanonical, sigBytes)
            }
        }

        if (matchedEntry == null) {
            return OimVerificationReport(
                status = SecurityStatus.INVALID_SIGNATURE,
                isRefused = true,
                effectiveReeditPermission = ReeditPermission.AUTHOR_ONLY,
                imageHashMatches = hashMatches,
                signatureValid = false,
                hasOutOfRangeNumbers = false,
                keyTrustedOffline = true,
                keyExpired = false,
                computedImageHash = computedIdatHash,
                declaredImageHash = declaredHash,
                canonicalJson = canonical,
                reason = "Invalid ECDSA P-256 signature: the metadata was altered."
            )
        }

        // Check key retirement windows (`not_after` vs `signed_at`, `verify_until` vs device clock)
        val notAfterMs = parseIsoMillis(matchedEntry.notAfterIso)
        val signedAtMs = parseIsoMillis(document.security.signedAtIso)
        if (notAfterMs != null && signedAtMs != null && signedAtMs > notAfterMs) {
            return OimVerificationReport(
                status = SecurityStatus.INVALID_SIGNATURE,
                isRefused = true,
                effectiveReeditPermission = ReeditPermission.AUTHOR_ONLY,
                imageHashMatches = hashMatches,
                signatureValid = false,
                hasOutOfRangeNumbers = false,
                keyTrustedOffline = true,
                keyExpired = true,
                computedImageHash = computedIdatHash,
                declaredImageHash = declaredHash,
                canonicalJson = canonical,
                reason = "Signed after key '${matchedEntry.keyId}' was retired."
            )
        }

        val verifyUntilMs = parseIsoMillis(matchedEntry.verifyUntilIso)
        val expSec = document.security.expiresAtEpochSec ?: matchedEntry.expiresAtEpochSec
        val expiredByClock = (verifyUntilMs != null && nowMs > (verifyUntilMs + CLOCK_SKEW_MS)) ||
            (expSec != null && (nowMs / 1000L) > expSec)

        if (expiredByClock) {
            return OimVerificationReport(
                status = SecurityStatus.EXPIRED_KEY,
                isRefused = false,
                effectiveReeditPermission = ReeditPermission.AUTHOR_ONLY,
                imageHashMatches = hashMatches,
                signatureValid = true,
                hasOutOfRangeNumbers = false,
                keyTrustedOffline = true,
                keyExpired = true,
                computedImageHash = computedIdatHash,
                declaredImageHash = declaredHash,
                canonicalJson = canonical,
                reason = "Valid signature, but key '${matchedEntry.keyId}' has expired and is no longer trusted."
            )
        }

        // Check IDAT image seal matching `security.ts`:
        // Only seals with `image_hash_alg == "sha256-idat"` (and a non-blank image_hash) are enforced;
        // files without it get IMAGE_UNSEALED instead of refusing legacy signed assets.
        if (!isSha256IdatAlg || declaredHash.isBlank()) {
            val status = if (matchedEntry.keyId == "oim-local-test-key") {
                SecurityStatus.VERIFIED_SELF_SIGNED
            } else {
                SecurityStatus.IMAGE_UNSEALED
            }
            return OimVerificationReport(
                status = status,
                isRefused = false,
                effectiveReeditPermission = document.security.reeditPermission,
                imageHashMatches = hashMatches,
                signatureValid = true,
                hasOutOfRangeNumbers = false,
                keyTrustedOffline = true,
                keyExpired = false,
                computedImageHash = computedIdatHash,
                declaredImageHash = declaredHash,
                canonicalJson = canonical,
                reason = "Valid ECDSA P-256 signature (${matchedEntry.keyId}); the file has no sha256-idat seal."
            )
        }

        if (!hashMatches) {
            return OimVerificationReport(
                status = SecurityStatus.REFUSED_TAMPERED,
                isRefused = true,
                effectiveReeditPermission = ReeditPermission.AUTHOR_ONLY,
                imageHashMatches = false,
                signatureValid = true,
                hasOutOfRangeNumbers = false,
                keyTrustedOffline = true,
                keyExpired = false,
                computedImageHash = computedIdatHash,
                declaredImageHash = declaredHash,
                canonicalJson = canonical,
                reason = "Broken sha256-idat seal: the image IDAT bytes do not match the signed seal."
            )
        }

        val verifiedStatus = if (matchedEntry.keyId == "oim-local-test-key") {
            SecurityStatus.VERIFIED_SELF_SIGNED
        } else {
            SecurityStatus.VERIFIED_TRUSTED
        }

        return OimVerificationReport(
            status = verifiedStatus,
            isRefused = false,
            effectiveReeditPermission = document.security.reeditPermission,
            imageHashMatches = true,
            signatureValid = true,
            hasOutOfRangeNumbers = false,
            keyTrustedOffline = true,
            keyExpired = false,
            computedImageHash = computedIdatHash,
            declaredImageHash = declaredHash,
            canonicalJson = canonical,
            reason = "sha256-idat seal and ECDSA P-256 signature verified with key '${matchedEntry.keyId}'."
        )
    }

    private fun legacyCanonicalJson(root: JSONObject): String {
        val exclusions = setOf("signature", "key_version", "timestamp")
        fun sortLegacy(value: Any?): Any? = when (value) {
            is JSONObject -> {
                val out = linkedMapOf<String, Any?>()
                val keys = buildList {
                    val iter = value.keys()
                    while (iter.hasNext()) add(iter.next())
                }.sorted()
                for (k in keys) out[k] = sortLegacy(value.opt(k))
                JSONObject(out)
            }
            is JSONArray -> JSONArray().apply {
                for (i in 0 until value.length()) put(sortLegacy(value.opt(i)))
            }
            else -> value
        }
        val filtered = JSONObject()
        val iter = root.keys()
        val keys = buildList { while (iter.hasNext()) add(iter.next()) }.filterNot { it in exclusions }.sorted()
        for (k in keys) filtered.put(k, sortLegacy(root.opt(k)))
        return filtered.toString()
    }

    private fun verifyEcdsaSignature(publicKey: PublicKey, payload: ByteArray, rawSig: ByteArray): Boolean {
        if (rawSig.isEmpty()) return false
        return try {
            // OIM signs in P1363 (r||s, 64 bytes). Its first byte can be 0x30 (~1 in 256),
            // so the length alone decides: sniffing for a DER header rejected valid files.
            val derBytes = if (rawSig.size == 64) {
                p1363ToDer(rawSig)
            } else {
                rawSig
            }
            val verifier = Signature.getInstance("SHA256withECDSA")
            verifier.initVerify(publicKey)
            verifier.update(payload)
            verifier.verify(derBytes)
        } catch (_: Exception) {
            false
        }
    }

    private fun p1363ToDer(p1363: ByteArray): ByteArray {
        val r = BigInteger(1, p1363.copyOfRange(0, 32)).toByteArray()
        val s = BigInteger(1, p1363.copyOfRange(32, 64)).toByteArray()
        val seq = ByteArrayOutputStream(72)
        seq.write(0x02)
        seq.write(r.size)
        seq.write(r)
        seq.write(0x02)
        seq.write(s.size)
        seq.write(s)
        val body = seq.toByteArray()
        val out = ByteArrayOutputStream(body.size + 2)
        out.write(0x30)
        out.write(body.size)
        out.write(body)
        return out.toByteArray()
    }

    private fun decodeSignatureBytes(sigStr: String): ByteArray {
        return try {
            if (sigStr.contains('-') || sigStr.contains('_')) {
                Base64Codec.decodeUrl(sigStr)
            } else {
                Base64Codec.decode(sigStr)
            }
        } catch (_: Exception) {
            ByteArray(0)
        }
    }

    private fun parseIsoMillis(iso: String?): Long? {
        if (iso.isNullOrBlank()) return null
        return try {
            Instant.parse(iso).toEpochMilli()
        } catch (_: Exception) {
            null
        }
    }

    private fun pickEarliestIso(a: String?, b: String?): String? {
        if (a.isNullOrBlank()) return b
        if (b.isNullOrBlank()) return a
        val ta = parseIsoMillis(a) ?: return b
        val tb = parseIsoMillis(b) ?: return a
        return if (ta <= tb) a else b
    }

    /**
     * Mirrors `@oim-media/core/dynamic-colors.ts` (`resolvePalette`).
     */
    fun resolvePalette(
        palettes: Map<String, Map<String, String>>,
        defaultPalette: String?,
        requested: String? = null,
        prefersDark: Boolean = true
    ): Pair<String, Map<String, String>>? {
        if (palettes.isEmpty()) return null
        val both = palettes.containsKey("dark") && palettes.containsKey("light")
        val byPreference = if (both) (if (prefersDark) "dark" else "light") else null
        val chosenName = listOfNotNull(requested, byPreference, defaultPalette)
            .firstOrNull { palettes.containsKey(it) } ?: return null
        val rawMap = palettes[chosenName].orEmpty()
        val clean = buildMap {
            for (role in DYNAMIC_COLOR_ROLES) {
                val value = rawMap[role]?.trim()
                if (!value.isNullOrBlank()) put(role, value)
            }
        }
        return chosenName to clean
    }

    /**
     * Mirrors `@oim-media/player-oim`:
     * - If `*` exists as own key, it is final/universal.
     * - Otherwise fallback order: requestedLang -> "en" -> "es" -> defaultLang -> first available value.
     */
    fun resolveContent(
        content: Map<String, String>,
        requestedLang: String,
        defaultLang: String = OimContract.DEFAULT_LANGUAGE
    ): ResolvedTextResult {
        if (content.isEmpty()) {
            return ResolvedTextResult("", "", emptyList(), false)
        }

        val normReq = requestedLang.lowercase().trim()
        val normDef = defaultLang.lowercase().trim()
        val trace = mutableListOf<String>()

        if (content.containsKey("*")) {
            return ResolvedTextResult(
                text = content.getValue("*"),
                matchedKey = "*",
                fallbackPath = listOf("* (final)"),
                wasFinalWildcard = true
            )
        }

        val order = linkedSetOf(normReq, "en", "es", normDef)
        for (candidate in order) {
            if (candidate.isBlank()) continue
            trace.add(candidate)
            val exact = content[candidate]
                ?: content.entries.firstOrNull { it.key.equals(candidate, ignoreCase = true) }?.value
            if (!exact.isNullOrEmpty()) {
                return ResolvedTextResult(
                    text = exact,
                    matchedKey = candidate,
                    fallbackPath = trace,
                    wasFinalWildcard = false
                )
            }
        }

        val firstEntry = content.entries.first()
        trace.add("first(${firstEntry.key})")
        return ResolvedTextResult(
            text = firstEntry.value,
            matchedKey = firstEntry.key,
            fallbackPath = trace,
            wasFinalWildcard = false
        )
    }
}

/**
 * Pure Kotlin RFC 4648 Base64 & Base64Url codec so crypto & PNG decoding work in
 * pure JVM unit tests (without Robolectric) as well as Android API 24+.
 */
object Base64Codec {
    private const val ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
    private val DECODE_TABLE = IntArray(256) { -1 }.apply {
        for (i in ALPHABET.indices) this[ALPHABET[i].code] = i
        this['-'.code] = 62
        this['_'.code] = 63
    }

    fun encode(bytes: ByteArray): String {
        val sb = StringBuilder(((bytes.size + 2) / 3) * 4)
        var i = 0
        while (i < bytes.size) {
            val b0 = bytes[i++].toInt() and 0xFF
            val hasB1 = i < bytes.size
            val b1 = if (hasB1) bytes[i++].toInt() and 0xFF else 0
            val hasB2 = i < bytes.size
            val b2 = if (hasB2) bytes[i++].toInt() and 0xFF else 0

            val n = (b0 shl 16) or (b1 shl 8) or b2
            sb.append(ALPHABET[(n ushr 18) and 0x3F])
            sb.append(ALPHABET[(n ushr 12) and 0x3F])
            sb.append(if (hasB1) ALPHABET[(n ushr 6) and 0x3F] else '=')
            sb.append(if (hasB2) ALPHABET[n and 0x3F] else '=')
        }
        return sb.toString()
    }

    fun decode(input: String): ByteArray {
        val out = ByteArrayOutputStream((input.length * 3) / 4 + 4)
        var buf = 0
        var bits = 0
        for (ch in input) {
            if (ch == '=' || ch.isWhitespace()) continue
            val code = if (ch.code < 256) DECODE_TABLE[ch.code] else -1
            if (code < 0) throw IllegalArgumentException("Invalid Base64 character: $ch")
            buf = (buf shl 6) or code
            bits += 6
            if (bits >= 8) {
                bits -= 8
                out.write((buf ushr bits) and 0xFF)
            }
        }
        return out.toByteArray()
    }

    fun decodeUrl(input: String): ByteArray = decode(input)
}
