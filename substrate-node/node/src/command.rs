//! Shadow Chain CLI commands implementation

use crate::{
    chain_spec,
    cli::{Cli, Subcommand},
    service,
};
use frame_benchmarking_cli::{BenchmarkCmd, ExtrinsicFactory, SUBSTRATE_REFERENCE_HARDWARE};
use shadowchain_runtime::{Block, EXISTENTIAL_DEPOSIT};
use sc_cli::{ChainSpec, RuntimeVersion, SubstrateCli};
use sc_service::PartialComponents;
use sp_keyring::Sr25519Keyring;

impl SubstrateCli for Cli {
    fn impl_name() -> String {
        "Shadow Chain Node".into()
    }

    fn impl_version() -> String {
        env!("SUBSTRATE_CLI_IMPL_VERSION").into()
    }

    fn description() -> String {
        env!("CARGO_PKG_DESCRIPTION").into()
    }

    fn author() -> String {
        env!("CARGO_PKG_AUTHORS").into()
    }

    fn support_url() -> String {
        "https://github.com/shadowchain/shadowchain/issues/new".into()
    }

    fn copyright_start_year() -> i32 {
        2024
    }

    fn load_spec(&self, id: &str) -> Result<Box<dyn sc_service::ChainSpec>, String> {
        Ok(match id {
            "dev" => Box::new(chain_spec::development_config()?),
            "" | "local" => Box::new(chain_spec::local_testnet_config()?),
            path => Box::new(chain_spec::ChainSpec::from_json_file(
                std::path::PathBuf::from(path),
            )?),
        })
    }

    fn native_runtime_version(_: &Box<dyn ChainSpec>) -> &'static RuntimeVersion {
        &shadowchain_runtime::VERSION
    }
}

/// Parse and run command line arguments
pub fn run() -> sc_cli::Result<()> {
    let cli = Cli::from_args();

    match &cli.subcommand {
        Some(Subcommand::Key(cmd)) => cmd.run(&cli),
        Some(Subcommand::BuildSpec(cmd)) => {
            let runner = cli.create_runner(cmd)?;
            runner.sync_run(|config| cmd.run(config.chain_spec, config.network))
        }
        Some(Subcommand::CheckBlock(cmd)) => {
            let runner = cli.create_runner(cmd)?;
            runner.async_run(|config| {
                let PartialComponents { client, task_manager, import_queue, .. } =
                    service::new_partial(&config)?;
                Ok((cmd.run(client, import_queue), task_manager))
            })
        }
        Some(Subcommand::ExportBlocks(cmd)) => {
            let runner = cli.create_runner(cmd)?;
            runner.async_run(|config| {
                let PartialComponents { client, task_manager, .. } = service::new_partial(&config)?;
                Ok((cmd.run(client, config.database), task_manager))
            })
        }
        Some(Subcommand::ExportState(cmd)) => {
            let runner = cli.create_runner(cmd)?;
            runner.async_run(|config| {
                let PartialComponents { client, task_manager, .. } = service::new_partial(&config)?;
                Ok((cmd.run(client, config.chain_spec), task_manager))
            })
        }
        Some(Subcommand::ImportBlocks(cmd)) => {
            let runner = cli.create_runner(cmd)?;
            runner.async_run(|config| {
                let PartialComponents { client, task_manager, import_queue, .. } =
                    service::new_partial(&config)?;
                Ok((cmd.run(client, import_queue), task_manager))
            })
        }
        Some(Subcommand::PurgeChain(cmd)) => {
            let runner = cli.create_runner(cmd)?;
            runner.sync_run(|config| cmd.run(config.database))
        }
        Some(Subcommand::Revert(cmd)) => {
            let runner = cli.create_runner(cmd)?;
            runner.async_run(|config| {
                let PartialComponents { client, task_manager, backend, .. } =
                    service::new_partial(&config)?;
                let aux_revert = Box::new(|client, _, blocks| {
                    sc_consensus_grandpa::revert(client, blocks)?;
                    Ok(())
                });
                Ok((cmd.run(client, backend, Some(aux_revert)), task_manager))
            })
        }
        Some(Subcommand::ChainInfo(cmd)) => {
            let runner = cli.create_runner(cmd)?;
            runner.sync_run(|config| cmd.run::<Block>(&config))
        }
        #[cfg(feature = "runtime-benchmarks")]
        Some(Subcommand::Benchmark(cmd)) => {
            let runner = cli.create_runner(cmd)?;

            runner.sync_run(|config| {
                // This switch needs to be in the client, since the client decides
                // which sub-commands it wants to support.
                match cmd {
                    BenchmarkCmd::Pallet(cmd) => {
                        if !cfg!(feature = "runtime-benchmarks") {
                            return Err("Runtime benchmarking wasn't enabled when building the node. \
                            You can enable it with `--features runtime-benchmarks`."
                                .into())
                        }

                        cmd.run::<Block, service::ExecutorDispatch>(config)
                    }
                    BenchmarkCmd::Block(cmd) => {
                        let PartialComponents { client, .. } = service::new_partial(&config)?;
                        cmd.run(client)
                    }
                    #[cfg(not(feature = "runtime-benchmarks"))]
                    BenchmarkCmd::Storage(_) => Err(
                        "Storage benchmarking can be enabled with `--features runtime-benchmarks`."
                            .into(),
                    ),
                    #[cfg(feature = "runtime-benchmarks")]
                    BenchmarkCmd::Storage(cmd) => {
                        let PartialComponents { client, backend, .. } =
                            service::new_partial(&config)?;
                        let db = backend.expose_db();
                        let storage = backend.expose_storage();

                        cmd.run(config, client, db, storage)
                    }
                    BenchmarkCmd::Overhead(cmd) => {
                        let PartialComponents { client, .. } = service::new_partial(&config)?;
                        let ext_builder = RemarkBuilder::new(client.clone());

                        cmd.run(
                            config,
                            client,
                            inherent_benchmark_data()?,
                            Vec::new(),
                            &ext_builder,
                        )
                    }
                    BenchmarkCmd::Extrinsic(cmd) => {
                        let PartialComponents { client, .. } = service::new_partial(&config)?;
                        // Register the *Remark* and *TKA* builders.
                        let ext_factory = ExtrinsicFactory(vec![
                            Box::new(RemarkBuilder::new(client.clone())),
                            Box::new(TransferKeepAliveBuilder::new(
                                client.clone(),
                                Sr25519Keyring::Alice.to_account_id(),
                                EXISTENTIAL_DEPOSIT,
                            )),
                        ]);

                        cmd.run(client, inherent_benchmark_data()?, Vec::new(), &ext_factory)
                    }
                    BenchmarkCmd::Machine(cmd) => {
                        cmd.run(&config, SUBSTRATE_REFERENCE_HARDWARE.clone())
                    }
                }
            })
        }
        #[cfg(feature = "try-runtime")]
        Some(Subcommand::TryRuntime(cmd)) => {
            use shadowchain_runtime::MILLISECS_PER_BLOCK;
            use try_runtime_cli::block_building_info::timestamp_with_aura_info;

            let runner = cli.create_runner(cmd)?;

            runner.async_run(|config| {
                let registry = config.prometheus_config.as_ref().map(|cfg| &cfg.registry);
                let task_manager =
                    sc_service::TaskManager::new(config.tokio_handle.clone(), registry)
                        .map_err(|e| sc_cli::Error::Service(sc_service::Error::Prometheus(e)))?;
                let info_provider = timestamp_with_aura_info(MILLISECS_PER_BLOCK);

                Ok((
                    cmd.run::<Block, service::ExecutorDispatch, _>(config, info_provider),
                    task_manager,
                ))
            })
        }
        #[cfg(not(feature = "try-runtime"))]
        Some(Subcommand::TryRuntime) => Err("TryRuntime wasn't enabled when building the node. \
                You can enable it with `--features try-runtime`."
            .into()),
        None => {
            let runner = cli.create_runner(&cli.run)?;
            runner.run_node_until_exit(|config| async move {
                service::new_full(config).map_err(sc_cli::Error::Service)
            })
        }
    }
}

/// Inherent data provider for benchmarks
fn inherent_benchmark_data() -> Result<sc_client_api::InherentData, sc_cli::Error> {
    use shadowchain_runtime::{Block, MILLISECS_PER_BLOCK, SLOT_DURATION};
    use sp_inherents::InherentDataProvider;

    let mut inherent_data = sc_client_api::InherentData::new();
    let d = std::time::Duration::from_millis(MILLISECS_PER_BLOCK);
    let timestamp = sp_timestamp::InherentDataProvider::new(d.into());
    let slot_duration = sp_consensus_aura::inherents::InherentDataProvider::new(
        sp_consensus_aura::Slot::from_timestamp(
            sp_timestamp::Timestamp::new(d.into()),
            sp_consensus_slots::SlotDuration::from_millis(SLOT_DURATION),
        ),
    );

    futures::executor::block_on(async {
        timestamp.provide_inherent_data(&mut inherent_data).await
    })
    .map_err(|e| sc_cli::Error::from(e))?;
    futures::executor::block_on(async {
        slot_duration.provide_inherent_data(&mut inherent_data).await
    })
    .map_err(|e| sc_cli::Error::from(e))?;

    Ok(inherent_data)
}

// Benchmark-specific builders
#[cfg(feature = "runtime-benchmarks")]
struct RemarkBuilder {
    client: Arc<service::FullClient>,
}

#[cfg(feature = "runtime-benchmarks")]
impl RemarkBuilder {
    fn new(client: Arc<service::FullClient>) -> Self {
        Self { client }
    }
}

#[cfg(feature = "runtime-benchmarks")]
impl frame_benchmarking_cli::ExtrinsicBuilder for RemarkBuilder {
    fn pallet(&self) -> &str {
        "system"
    }

    fn extrinsic(&self) -> &str {
        "remark"
    }

    fn build(&self, nonce: u32) -> Result<sp_runtime::OpaqueExtrinsic, &str> {
        use sp_runtime::{generic::Era, MultiAddress, MultiSignature};

        let acc = Sr25519Keyring::Bob.pair();
        let extrinsic: sp_runtime::OpaqueExtrinsic = create_extrinsic(
            self.client.as_ref(),
            acc,
            SystemCall::remark { remark: vec![] },
            Some(nonce),
        )
        .into();

        Ok(extrinsic)
    }
}

#[cfg(feature = "runtime-benchmarks")]
struct TransferKeepAliveBuilder {
    client: Arc<service::FullClient>,
    dest: AccountId,
    value: Balance,
}

#[cfg(feature = "runtime-benchmarks")]
impl TransferKeepAliveBuilder {
    fn new(client: Arc<service::FullClient>, dest: AccountId, value: Balance) -> Self {
        Self { client, dest, value }
    }
}

#[cfg(feature = "runtime-benchmarks")]
impl frame_benchmarking_cli::ExtrinsicBuilder for TransferKeepAliveBuilder {
    fn pallet(&self) -> &str {
        "balances"
    }

    fn extrinsic(&self) -> &str {
        "transfer_keep_alive"
    }

    fn build(&self, nonce: u32) -> Result<sp_runtime::OpaqueExtrinsic, &str> {
        let acc = Sr25519Keyring::Bob.pair();
        let extrinsic: sp_runtime::OpaqueExtrinsic = create_extrinsic(
            self.client.as_ref(),
            acc,
            BalancesCall::transfer_keep_alive {
                dest: self.dest.clone().into(),
                value: self.value,
            },
            Some(nonce),
        )
        .into();

        Ok(extrinsic)
    }
}

/// Create a transaction using the given `call`.
#[cfg(feature = "runtime-benchmarks")]
fn create_extrinsic(
    client: &service::FullClient,
    sender: sp_core::sr25519::Pair,
    call: impl Into<shadowchain_runtime::RuntimeCall>,
    nonce: Option<u32>,
) -> shadowchain_runtime::UncheckedExtrinsic {
    use shadowchain_runtime::{
        AccountId, RuntimeCall, SignedExtra, SignedPayload, Signature, EXISTENTIAL_DEPOSIT,
    };
    use sp_runtime::{
        generic::Era,
        traits::{IdentifyAccount, SignedExtension},
        MultiAddress, MultiSignature,
    };

    let call = call.into();
    let genesis_hash = client.block_hash(0).ok().flatten().expect("Genesis block exists; qed");
    let best_block = client.chain_info().best_hash;
    let best_block_number = client.chain_info().best_number;
    let nonce = nonce.unwrap_or_else(|| {
        let account = AccountId::from(sender.public());
        frame_system::Account::<shadowchain_runtime::Runtime>::get(&account).nonce as u32
    });

    let tip = 0;
    let extra: SignedExtra = (
        frame_system::CheckNonZeroSender::<shadowchain_runtime::Runtime>::new(),
        frame_system::CheckSpecVersion::<shadowchain_runtime::Runtime>::new(),
        frame_system::CheckTxVersion::<shadowchain_runtime::Runtime>::new(),
        frame_system::CheckGenesis::<shadowchain_runtime::Runtime>::new(),
        frame_system::CheckEra::<shadowchain_runtime::Runtime>::from(Era::mortal(
            256,
            best_block_number.saturated_into(),
        )),
        frame_system::CheckNonce::<shadowchain_runtime::Runtime>::from(nonce.into()),
        frame_system::CheckWeight::<shadowchain_runtime::Runtime>::new(),
        pallet_transaction_payment::ChargeTransactionPayment::<shadowchain_runtime::Runtime>::from(
            tip,
        ),
    );

    let raw_payload = SignedPayload::from_raw(
        call.clone(),
        extra.clone(),
        (
            (),
            shadowchain_runtime::VERSION.spec_version,
            shadowchain_runtime::VERSION.transaction_version,
            genesis_hash,
            best_block,
            (),
            (),
            (),
        ),
    );
    let signature = raw_payload.using_encoded(|e| sender.sign(e));

    shadowchain_runtime::UncheckedExtrinsic::new_signed(
        call,
        MultiAddress::Id(AccountId::from(sender.public())),
        MultiSignature::Sr25519(signature),
        extra,
    )
}

use shadowchain_runtime::{AccountId, Balance, BalancesCall, SystemCall};
use sp_runtime::traits::Saturating;
use std::sync::Arc;