// Copyright (c) 2026 Xue Studios LLC
// SPDX-License-Identifier: Apache-2.0

//! Read, verify and interpret `.oim` files. Packaging and signing are the CLI's job.

mod canonical;
mod content;
mod error;
mod extract;
mod keys;
mod reedit;
mod verify;

pub use canonical::{canonical_json, has_number_out_of_range};
pub use content::{DEFAULT_LANGUAGE, resolve_content};
pub use error::OimError;
pub use extract::{Extraction, extract};
pub use reedit::{ReeditPermission, reedit_permission};
pub use verify::{SecurityStatus, is_refused, verify};

/// The contract version this crate implements.
pub const CONTRACT_VERSION: &str = env!("CARGO_PKG_VERSION");
