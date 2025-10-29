// This file exists to make the substrate-node directory a valid Rust crate.
// It's needed for the parachain template structure.

#![cfg_attr(not(feature = "std"), no_std)]

// Re-export the runtime for use in the node
pub use shadowchain_runtime;