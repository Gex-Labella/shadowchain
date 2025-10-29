//! Shadow Chain specification.

use shadowchain_runtime as runtime;
use sc_service::{ChainType, Properties};
use sc_chain_spec::{ChainSpecExtension, Extension};
use serde::{Deserialize, Serialize};
use sp_core::Pair;
use sp_runtime::traits::IdentifyAccount;

/// Specialized `ChainSpec` for the normal parachain runtime.
pub type ChainSpec = sc_service::GenericChainSpec<Extensions>;

/// The relay chain that you want to configure this parachain to connect to.
pub const RELAY_CHAIN: &str = "rococo-local";

/// The extensions for the [`ChainSpec`].
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Extensions {
    /// The relay chain of the Parachain.
    #[serde(alias = "relayChain", alias = "RelayChain")]
    pub relay_chain: String,
    /// The para id of this parachain.
    #[serde(alias = "paraId", alias = "ParaId")]
    pub para_id: u32,
}

impl Extensions {
    /// Try to get the extension from the given `ChainSpec`.
    pub fn try_get(chain_spec: &dyn sc_service::ChainSpec) -> Option<&Self> {
        Extension::try_get(chain_spec.extensions())
    }
}

impl Extension for Extensions {
    type Forks = Option<()>;

    fn get<T: 'static>(&self) -> Option<&T> {
        None
    }

    fn get_any(&self, _: std::any::TypeId) -> &dyn std::any::Any {
        self
    }

    fn get_any_mut(&mut self, _: std::any::TypeId) -> &mut dyn std::any::Any {
        self
    }
}

impl From<Extensions> for ChainSpecExtension {
    fn from(ext: Extensions) -> Self {
        ChainSpecExtension::new(ext)
    }
}

type AccountPublic = <runtime::Signature as sp_runtime::traits::Verify>::Signer;

/// Helper function to generate a crypto pair from seed.
pub fn get_from_seed<TPublic: sp_core::Public>(seed: &str) -> <TPublic::Pair as Pair>::Public {
    TPublic::Pair::from_string(&format!("//{}", seed), None)
        .expect("static values are valid; qed")
        .public()
}

/// Generate collator keys from seed.
///
/// This function's return type must always match the session keys of the chain in tuple format.
pub fn get_collator_keys_from_seed(seed: &str) -> runtime::SessionKeys {
    runtime::SessionKeys {
        aura: get_from_seed::<runtime::AuraId>(seed),
        grandpa: get_from_seed::<runtime::GrandpaId>(seed),
    }
}

/// Helper function to generate an account ID from seed.
pub fn get_account_id_from_seed<TPublic: sp_core::Public>(seed: &str) -> runtime::AccountId
where
    AccountPublic: From<<TPublic::Pair as sp_core::Pair>::Public>,
{
    AccountPublic::from(get_from_seed::<TPublic>(seed)).into_account()
}

pub fn development_config() -> ChainSpec {
    // Give your base currency a unit name and decimal places
    let mut properties = Properties::new();
    properties.insert("tokenSymbol".into(), "SHDW".into());
    properties.insert("tokenDecimals".into(), 12.into());
    properties.insert("ss58Format".into(), 42.into());

    ChainSpec::builder(
        runtime::WASM_BINARY.expect("WASM binary was not built, please build it!"),
        Extensions { 
            relay_chain: RELAY_CHAIN.into(),
            para_id: 1000,
        },
    )
    .with_name("Shadow Development")
    .with_id("shadow_dev")
    .with_chain_type(ChainType::Development)
    .with_genesis_config_preset_name("development")
    .with_properties(properties)
    .build()
}

pub fn local_testnet_config() -> ChainSpec {
    // Give your base currency a unit name and decimal places
    let mut properties = Properties::new();
    properties.insert("tokenSymbol".into(), "SHDW".into());
    properties.insert("tokenDecimals".into(), 12.into());
    properties.insert("ss58Format".into(), 42.into());

    ChainSpec::builder(
        runtime::WASM_BINARY.expect("WASM binary was not built, please build it!"),
        Extensions { 
            relay_chain: RELAY_CHAIN.into(),
            para_id: 1000,
        },
    )
    .with_name("Shadow Local Testnet")
    .with_id("shadow_local_testnet")
    .with_chain_type(ChainType::Local)
    .with_genesis_config_preset_name("local_testnet")
    .with_protocol_id("shadow-local")
    .with_properties(properties)
    .build()
}