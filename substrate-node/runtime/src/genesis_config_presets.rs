//! Genesis config presets for the Shadow Chain runtime.

use crate::{
    AccountId, Balance, BalancesConfig, RuntimeGenesisConfig, Signature, SudoConfig,
    EXISTENTIAL_DEPOSIT,
};
use alloc::{format, vec, vec::Vec};
use sp_core::{sr25519, Pair, Public};
use sp_genesis_builder::PresetId;
use sp_runtime::traits::{IdentifyAccount, Verify};

/// Generate a crypto pair from seed.
pub fn get_from_seed<TPublic: Public>(seed: &str) -> <TPublic::Pair as Pair>::Public {
    TPublic::Pair::from_string(&format!("//{}", seed), None)
        .expect("static values are valid; qed")
        .public()
}

type AccountPublic = <Signature as Verify>::Signer;

/// Generate an account ID from seed.
pub fn get_account_id_from_seed<TPublic: Public>(seed: &str) -> AccountId
where
    AccountPublic: From<<TPublic::Pair as Pair>::Public>,
{
    AccountPublic::from(get_from_seed::<TPublic>(seed)).into_account()
}

/// Generate an Aura authority key.
pub fn authority_keys_from_seed(s: &str) -> (sp_consensus_aura::sr25519::AuthorityId, sp_consensus_grandpa::AuthorityId) {
    (
        get_from_seed::<sp_consensus_aura::sr25519::AuthorityId>(s),
        get_from_seed::<sp_consensus_grandpa::AuthorityId>(s),
    )
}

fn configure_accounts_for_testing() -> Vec<(AccountId, Balance)> {
    vec![
        (get_account_id_from_seed::<sr25519::Public>("Alice"), 1_000 * EXISTENTIAL_DEPOSIT),
        (get_account_id_from_seed::<sr25519::Public>("Bob"), 1_000 * EXISTENTIAL_DEPOSIT),
        (get_account_id_from_seed::<sr25519::Public>("Charlie"), 1_000 * EXISTENTIAL_DEPOSIT),
        (get_account_id_from_seed::<sr25519::Public>("Dave"), 1_000 * EXISTENTIAL_DEPOSIT),
        (get_account_id_from_seed::<sr25519::Public>("Eve"), 1_000 * EXISTENTIAL_DEPOSIT),
        (get_account_id_from_seed::<sr25519::Public>("Ferdie"), 1_000 * EXISTENTIAL_DEPOSIT),
        (get_account_id_from_seed::<sr25519::Public>("Alice//stash"), 1_000 * EXISTENTIAL_DEPOSIT),
        (get_account_id_from_seed::<sr25519::Public>("Bob//stash"), 1_000 * EXISTENTIAL_DEPOSIT),
        (get_account_id_from_seed::<sr25519::Public>("Charlie//stash"), 1_000 * EXISTENTIAL_DEPOSIT),
        (get_account_id_from_seed::<sr25519::Public>("Dave//stash"), 1_000 * EXISTENTIAL_DEPOSIT),
        (get_account_id_from_seed::<sr25519::Public>("Eve//stash"), 1_000 * EXISTENTIAL_DEPOSIT),
        (get_account_id_from_seed::<sr25519::Public>("Ferdie//stash"), 1_000 * EXISTENTIAL_DEPOSIT),
    ]
}

/// Configure initial storage state for FRAME modules.
fn development_genesis_config() -> RuntimeGenesisConfig {
    let endowed_accounts = configure_accounts_for_testing();

    RuntimeGenesisConfig {
        system: Default::default(),
        balances: BalancesConfig {
            balances: endowed_accounts.clone(),
        },
        aura: Default::default(),
        grandpa: Default::default(),
        sudo: SudoConfig {
            key: Some(get_account_id_from_seed::<sr25519::Public>("Alice")),
        },
        transaction_payment: Default::default(),
        shadow: Default::default(),
    }
}

/// Configure initial storage state for FRAME modules.
fn local_testnet_genesis_config() -> RuntimeGenesisConfig {
    development_genesis_config()
}

/// Provides the JSON representation of predefined genesis config for given `id`.
pub fn get_preset(id: &PresetId) -> Option<Vec<u8>> {
    let genesis = match id.try_into() {
        Ok(sp_genesis_builder::DEV_RUNTIME_PRESET) => development_genesis_config(),
        Ok(sp_genesis_builder::LOCAL_TESTNET_RUNTIME_PRESET) => local_testnet_genesis_config(),
        _ => return None,
    };
    
    // Using alloc-compatible serde_json serialization
    serde_json::to_string(&genesis)
        .ok()
        .map(|s| s.into_bytes())
}

/// List of supported presets.
pub fn preset_names() -> Vec<PresetId> {
    vec![
        PresetId::from(sp_genesis_builder::DEV_RUNTIME_PRESET),
        PresetId::from(sp_genesis_builder::LOCAL_TESTNET_RUNTIME_PRESET),
    ]
}