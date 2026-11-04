// Copyright (c) 2026 Xue Studios LLC
// SPDX-License-Identifier: Apache-2.0

use std::fmt;

/// Why a byte buffer could not be read as a `.oim`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum OimError {
    /// Not a PNG, or a PNG without an `OIM_Data` chunk.
    NotOim,
    /// The OIM chunk is there but its payload cannot be decoded.
    Corrupt(String),
    /// A chunk claims more bytes than the buffer holds.
    Truncated,
}

impl fmt::Display for OimError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            OimError::NotOim => write!(f, "not an .oim file"),
            OimError::Corrupt(why) => write!(f, "corrupt OIM metadata: {why}"),
            OimError::Truncated => write!(f, "truncated PNG"),
        }
    }
}

impl std::error::Error for OimError {}
