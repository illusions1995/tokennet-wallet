/*
	React Core
 */
import React, { Component } from 'react';
import { Route, withRouter } from 'react-router-dom';
import { connect } from 'react-redux';
import * as actions from "actions/index";
import { StellarStreamers } from 'libs/stellar-toolkit';

/*
	Libraries
 */
import async from 'async';
import axios from 'axios';
import moment from 'moment';
import T from 'i18n-react';

/*
	Views
 */
import MainPageView from './views/MainPageView';
import WalletView from './views/WalletView';
import LoginView from './views/LoginView';
import SendCoinView from './views/SendCoinView';
import ReceiveCoinView from './views/ReceiveCoinView';
import Header from 'components/Header';
import Spinner from 'components/Spinner';
import CopyComplete from 'components/CopyComplete';
import ConfirmGeneratorOpen from 'modal-popups/ConfirmGeneratorOpen';
import KeyGenerator from 'modal-popups/KeyGenerator'
import TransactionConfirm from 'modal-popups/TransactionConfirm';
import TransactionComplete from 'modal-popups/TransactionComplete';
import RecordSeeds from 'modal-popups/RecordSeeds';

/*
	Styles
 */
import './App.scss';
import 'assets/sass/App.scss';
import StreamManager from "./StreamManager";

const { OffersStream, EffectsStream, AccountStream, PaymentStream } = StellarStreamers;

const config = require( 'config.json' );

class App extends Component {
	constructor() {
		super();

		this.state = {
			publicKey: null,
		};

		const userLang = navigator.language || navigator.userLanguage;
		this.selectLang( userLang );

		this.checkKillSwitch = this.checkKillSwitch.bind( this );

		this.checkKillSwitch();
	}

	selectLang( $lang ) {
		let lang = 'en';
		switch ( $lang ) {
			case 'ko' :
				lang = 'ko';
				break;
			default:
				lang = 'en';
		}
		T.setTexts( require( './languages/' + lang + '.json' ) );
	}

	checkKillSwitch() {
		const queue = [];
		queue.push( callback => {
			axios.get( config.ks_url + '?' + Math.random() )
				.then( response => {
					if ( response.data !== undefined ) {
						callback( null, response.data );
					}
				} )
				.catch( error => {
					console.error( error );
					callback( 'Kill Switch data load fail.' );
				} );
		} );
		queue.push( ( killSwitch, callback ) => {
			if ( killSwitch.start_time === undefined ) {
				callback( 'start_time required.' );
				return;
			}
			if ( killSwitch.end_time === undefined ) {
				callback( 'end_time required.' );
				return;
			}
			const now = moment();
			const start = killSwitch.start_time;
			const end = killSwitch.end_time;
			const result = {
				onMaintenance: false,
				message: null,
			};

			if ( 0 <= now.diff( start ) && now.diff( end ) < 0 ) {
				result.onMaintenance = true;
				result.message = killSwitch.message;
			}

			callback( null, result );
		} );

		async.waterfall( queue, ( error, result ) => {
			if ( error ) {
				this.props.setMaintenance( {
					onMaintenance: false,
					message: null,
				} );
			}
			else if ( result ) {
				this.props.setMaintenance( result );

				if ( result.onMaintenance ) {
					if ( window.location.pathname !== '/' ) {
						window.location.href = '/';
					}
				}

				setTimeout( () => {
					this.checkKillSwitch();
				}, config.ks_interval * 1000 );
			}
		} );
	}

	render() {
		return (
			<div className="App">

				<ConfirmGeneratorOpen modalOpen={this.props.showGeneratorConfirm}/>
				<KeyGenerator modalOpen={this.props.showKeyGenerator}/>
				<RecordSeeds modalOpen={this.props.showRecordSeed}/>
				<TransactionConfirm modalOpen={this.props.showTransactionConfirm}/>
				<TransactionComplete modalOpen={this.props.showTransactionComplete}/>
				<CopyComplete show={this.props.showCopyComplete}/>
				<Spinner spinnerShow={this.props.showSpinner}/>
				<Header/>

				<Route exact path="/" component={MainPageView}/>
				<Route path="/wallet" component={WalletView}/>
				<Route path="/login" component={LoginView}/>
				<Route path="/send" component={SendCoinView}/>
				<Route path="/receive" component={ReceiveCoinView}/>

				<div className="copyright">
					BOS Platform Foundation 2017
				</div>
			</div>
		);
	}

	componentWillReceiveProps( nextProps ) {
		if ( nextProps.keypair ) {
			if ( nextProps.keypair.publicKey() !== this.state.publicKey ) {
				const keypair = nextProps.keypair;

				this.setState( {
					publicKey: nextProps.keypair.publicKey(),
				} );

				// 기존 스트림 제거
				StreamManager.stopAllStream();

				// 스트림 시작
				StreamManager.accountStream = AccountStream( keypair.publicKey(), ( streamAccount ) => {
					this.props.streamAccount( streamAccount );
				} );
				StreamManager.effectsStream = EffectsStream( keypair.publicKey(), ( effects ) => {
					this.props.streamEffects( effects );
				} );
				StreamManager.offersStream = OffersStream( keypair.publicKey(), ( offers ) => {
					this.props.streamOffers( offers );
				} );
				StreamManager.paymentStream = PaymentStream( keypair.publicKey(), ( payment ) => {
					this.props.streamPayment( payment );
				} );
			}
		}
		else {
			// 기존 스트림 제거
			StreamManager.stopAllStream();
		}

		this.selectLang( nextProps.language );
	}
}

const mapStateToProps = ( state ) => ({
	language: state.language.language,
	keypair: state.keypair.keypair,
	showSpinner: state.spinner.isShow,
	showKeyGenerator: state.keyGenerator.isShow,
	showGeneratorConfirm: state.generatorConfirm.isShow,
	showRecordSeed: state.recordSeed.isShow,
	showCopyComplete: state.copyComplete.isShow,
	showTransactionConfirm: state.transactionConfirm.isShow,
	showTransactionComplete: state.transactionComplete.isShow,
	payment: state.stream.payment,
});

const mapDispatchToStore = ( dispatch ) => ( {
	streamAccount: ( $account ) => {
		dispatch( actions.streamAccount( $account ) );
	},
	streamEffects: ( $effects ) => {
		dispatch( actions.streamEffects( $effects ) );
	},
	streamOffers: ( $offers ) => {
		dispatch( actions.streamOffers( $offers ) );
	},
	streamPayment: ( $payment ) => {
		dispatch( actions.streamPayment( $payment ) );
	},
	resetHistory: () => {
		dispatch( actions.resetHistory() );
	},
	setMaintenance: ( maintenanceData ) => {
		dispatch( actions.setMaintenance( maintenanceData ) );
	},
} );

App = withRouter( connect( mapStateToProps, mapDispatchToStore )( App ) );

export default App;
