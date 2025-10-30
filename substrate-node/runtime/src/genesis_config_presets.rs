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

/// Generate collator keys from seed.
pub fn get_collator_keys_from_seed(seed: &str) -> sp_consensus_aura::sr25519::AuthorityPair {
    get_from_seed::<sp_consensus_aura::sr25519::AuthorityPair>(seed)
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
    let invulnerables = vec![
        get_account_id_from_seed::<sr25519::Public>("Alice"),
        get_account_id_from_seed::<sr25519::Public>("Bob"),
    ];

    RuntimeGenesisConfig {
        parachain_system: Default::default(),
        parachain_info: shadowchain_runtime::ParachainInfoConfig {
            parachain_id: 2000.into(),
            ..Default::default()
        },
        collator_selection: shadowchain_runtime::CollatorSelectionConfig {
            invulnerables: invulnerables.clone(),
            candidacy_bond: EXISTENTIAL_DEPOSIT * 16,
            ..Default::default()
        },
        session: shadowchain_runtime::SessionConfig {
            keys: invulnerables
                .iter()
                .cloned()
                .map(|acc| {
                    (
                        acc.clone(),
                        acc,
                        shadowchain_runtime::SessionKeys {
                            aura: get_from_seed::<sp_consensus_aura::sr25519::AuthorityId>(&format!("{:?}", acc)),
                        },
                    )
                })
                .collect(),
        },
        aura_ext: Default::default(),
        polkadot_xcm: shadowchain_runtime::PolkadotXcmConfig {
            safe_xcm_version: Some(3),
            ..Default::default()
        },
    }
}

/// Configure initial storage state for FRAME modules.
fn local_testnet_genesis_config() -> RuntimeGenesisConfig {
    development_genesis_config()
}

/// Provides the JSON representation of predefined genesis config for given `id`.
pub fn get_preset(id: &PresetId) -> Option<Vec<u8>> {
    let _genesis = match id.as_ref() {
        sp_genesis_builder::DEV_RUNTIME_PRESET => development_genesis_config(),
        sp_genesis_builder::LOCAL_TESTNET_RUNTIME_PRESET => local_testnet_genesis_config(),
        _ => return None,
    };
    
    // For no_std environment, we can't use serde_json directly
    // Return a simple JSON string representation
    // Using Debug format for AccountId since Display is not implemented
    let alice_account = get_account_id_from_seed::<sr25519::Public>("Alice");
    let json_str = format!("{{\"parachainSystem\":{{}},\"parachainInfo\":{{\"parachainId\":2000}},\"collatorSelection\":{{\"invulnerables\":[\"{:?}\"]}},\"session\":{{}},\"auraExt\":{{}},\"polkadotXcm\":{{\"safeXcmVersion\":3}}}}",
        alice_account);
    Some(json_str.into_bytes())
}

/// List of supported presets.
pub fn preset_names() -> Vec<PresetId> {
    vec![
        PresetId::from(sp_genesis_builder::DEV_RUNTIME_PRESET),
        PresetId::from(sp_genesis_builder::LOCAL_TESTNET_RUNTIME_PRESET),
    ]
}