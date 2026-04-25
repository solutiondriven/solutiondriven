"""
Copy Trading Engine - Core hub for broadcasting signals to followers
Manages signal lifecycle: create -> broadcast -> track -> sync SL/TP -> close
"""

import logging
from datetime import datetime
import json
import uuid

logger = logging.getLogger(__name__)


class CopyTradingEngine:
    """
    Central hub for copy-trading operations
    Coordinates: MT5, Binance, Bitget brokers to execute synchronized trades
    """
    
    def __init__(self, mt5_bridge=None, binance_bridge=None, bitget_bridge=None):
        """
        Initialize copy-trading engine with broker bridges
        
        Args:
            mt5_bridge: MT5Bridge instance (for forex)
            binance_bridge: BinanceBridge instance (for spot crypto)
            bitget_bridge: BitgetBridge instance (for backup crypto)
        """
        self.mt5 = mt5_bridge
        self.binance = binance_bridge
        self.bitget = bitget_bridge
        
        self.signals = {}  # Active signals: {signal_id: signal_data}
        self.followers = {}  # Registered followers: {follower_id: follower_data}
        self.trades = {}  # Executed trades: {trade_id: trade_data}
        
        logger.info("Copy-Trading Engine initialized")
    
    # ============================================
    # SIGNAL MANAGEMENT
    # ============================================
    
    def create_signal(self, strategy, symbol, action, volume, stop_loss=None, take_profit=None, broker='mt5'):
        """
        Create a new trade signal
        
        Args:
            strategy: Strategy name (e.g., 'TemiStrategy')
            symbol: Asset symbol (e.g., 'EURUSD' for MT5, 'BTCUSDT' for crypto)
            action: 'BUY' or 'SELL'
            volume: Order size
            stop_loss: Optional stop loss price
            take_profit: Optional take profit price
            broker: 'mt5', 'binance', or 'bitget'
            
        Returns:
            dict: Signal details with unique ID
        """
        signal_id = str(uuid.uuid4())[:8]
        
        signal = {
            'id': signal_id,
            'strategy': strategy,
            'symbol': symbol,
            'action': action,
            'volume': volume,
            'stop_loss': stop_loss,
            'take_profit': take_profit,
            'broker': broker,
            'status': 'ACTIVE',
            'created_at': datetime.now().isoformat(),
            'broadcasts': [],  # Track which followers received this signal
            'followers_executed': [],  # Track which followers executed
            'followers_failed': []  # Track failures
        }
        
        self.signals[signal_id] = signal
        logger.info(f"Signal created: {signal_id} - {action} {volume} {symbol}")
        
        return signal
    
    def broadcast_signal(self, signal_id):
        """
        Broadcast signal to all registered followers
        Each follower executes on their configured broker
        
        Args:
            signal_id: ID of signal to broadcast
            
        Returns:
            dict: Broadcast results
        """
        if signal_id not in self.signals:
            return {'success': False, 'error': f'Signal {signal_id} not found'}
        
        signal = self.signals[signal_id]
        results = {
            'signal_id': signal_id,
            'timestamp': datetime.now().isoformat(),
            'followers_count': len(self.followers),
            'executions': []
        }
        
        for follower_id, follower in self.followers.items():
            if not follower.get('active', True):
                continue
            
            # Get the bridge for this follower's broker type
            broker_type = follower.get('broker_type')
            bridge = self._get_bridge_for_type(broker_type)
            
            if not bridge:
                logger.warning(f"No bridge configured for {broker_type}")
                signal['followers_failed'].append(follower_id)
                continue
            
            # Execute the signal on this follower's broker
            execution = self._execute_for_follower(
                follower_id=follower_id,
                follower=follower,
                signal=signal,
                bridge=bridge
            )
            
            results['executions'].append(execution)
            
            if execution.get('success'):
                signal['followers_executed'].append(follower_id)
            else:
                signal['followers_failed'].append(follower_id)
        
        signal['broadcasts'].append(results)
        logger.info(f"Signal broadcast complete: {len(signal['followers_executed'])} executed, "
                   f"{len(signal['followers_failed'])} failed")
        
        return results
    
    def _get_bridge_for_type(self, broker_type):
        """Get the appropriate bridge for broker type"""
        if broker_type == 'mt5':
            return self.mt5
        elif broker_type == 'binance':
            return self.binance
        elif broker_type == 'bitget':
            return self.bitget
        return None
    
    def _execute_for_follower(self, follower_id, follower, signal, bridge):
        """Execute a signal on a follower's account"""
        try:
            # Adjust volume based on follower's settings
            follower_volume = self._adjust_volume(signal['volume'], follower)
            
            # Execute the order
            result = bridge.execute_order(
                symbol=signal['symbol'],
                action=signal['action'],
                volume=follower_volume
            )
            
            if result.get('success'):
                # Record the trade
                trade_id = str(uuid.uuid4())[:8]
                trade = {
                    'id': trade_id,
                    'signal_id': signal['id'],
                    'follower_id': follower_id,
                    'symbol': signal['symbol'],
                    'action': signal['action'],
                    'volume': follower_volume,
                    'status': 'OPEN',
                    'entry_time': datetime.now().isoformat(),
                    'pnl': 0,
                    'order_id': result.get('order_id')
                }
                self.trades[trade_id] = trade
                
                logger.info(f"Trade executed: {trade_id} for {follower_id}")
                
                return {
                    'success': True,
                    'follower_id': follower_id,
                    'trade_id': trade_id,
                    'symbol': signal['symbol'],
                    'volume': follower_volume,
                    'message': 'Order placed'
                }
            else:
                logger.error(f"Execution failed for {follower_id}: {result.get('error')}")
                return {
                    'success': False,
                    'follower_id': follower_id,
                    'error': result.get('error')
                }
                
        except Exception as e:
            logger.error(f"Error executing for {follower_id}: {str(e)}")
            return {
                'success': False,
                'follower_id': follower_id,
                'error': str(e)
            }
    
    def _adjust_volume(self, master_volume, follower):
        """Adjust volume based on follower's risk profile"""
        adjustment_factor = follower.get('volume_factor', 1.0)
        return master_volume * adjustment_factor
    
    # ============================================
    # FOLLOWER MANAGEMENT
    # ============================================
    
    def add_follower(self, follower_id, broker_type, credentials, volume_factor=1.0):
        """
        Register a new follower account
        
        Args:
            follower_id: Unique follower identifier
            broker_type: 'mt5', 'binance', or 'bitget'
            credentials: dict with API keys/password
            volume_factor: Volume adjustment (1.0 = same as master, 0.5 = half)
            
        Returns:
            dict: Follower registration result
        """
        try:
            # Connect the appropriate bridge
            bridge = self._get_bridge_for_type(broker_type)
            if not bridge:
                return {'success': False, 'error': f'No handler for {broker_type}'}
            
            # Connect with credentials
            if broker_type == 'mt5':
                connect_result = bridge.connect(
                    account=credentials.get('account'),
                    password=credentials.get('password'),
                    server=credentials.get('server')
                )
            else:  # binance or bitget
                if broker_type == 'bitget':
                    connect_result = bridge.connect(
                        api_key=credentials.get('api_key'),
                        api_secret=credentials.get('api_secret'),
                        passphrase=credentials.get('passphrase')
                    )
                else:  # binance
                    connect_result = bridge.connect(
                        api_key=credentials.get('api_key'),
                        api_secret=credentials.get('api_secret')
                    )
            
            if not connect_result.get('success'):
                return {'success': False, 'error': 'Connection failed'}
            
            # Register follower
            follower = {
                'id': follower_id,
                'broker_type': broker_type,
                'active': True,
                'volume_factor': volume_factor,
                'registered_at': datetime.now().isoformat(),
                'total_trades': 0,
                'total_pnl': 0,
                'credentials': credentials  # Store (in production: encrypt this)
            }
            
            self.followers[follower_id] = follower
            logger.info(f"Follower registered: {follower_id} ({broker_type})")
            
            return {
                'success': True,
                'follower_id': follower_id,
                'broker_type': broker_type,
                'message': 'Follower registered successfully'
            }
            
        except Exception as e:
            logger.error(f"Error registering follower: {str(e)}")
            return {'success': False, 'error': str(e)}
    
    def remove_follower(self, follower_id):
        """Unregister a follower"""
        if follower_id in self.followers:
            del self.followers[follower_id]
            logger.info(f"Follower removed: {follower_id}")
            return {'success': True}
        return {'success': False, 'error': 'Follower not found'}
    
    def get_follower(self, follower_id):
        """Get follower details"""
        return self.followers.get(follower_id, {})
    
    def list_followers(self):
        """Get all followers"""
        return list(self.followers.values())
    
    # ============================================
    # POSITION MANAGEMENT
    # ============================================
    
    def close_signal(self, signal_id):
        """
        Close all positions from a signal
        
        Args:
            signal_id: Signal ID to close
            
        Returns:
            dict: Close results
        """
        if signal_id not in self.signals:
            return {'success': False, 'error': f'Signal {signal_id} not found'}
        
        signal = self.signals[signal_id]
        signal['status'] = 'CLOSED'
        
        # Find and close all trades for this signal
        close_results = []
        for trade_id, trade in list(self.trades.items()):
            if trade['signal_id'] == signal_id and trade['status'] == 'OPEN':
                follower = self.followers.get(trade['follower_id'])
                bridge = self._get_bridge_for_type(follower.get('broker_type'))
                
                if bridge:
                    result = bridge.close_position(trade['symbol'], trade['volume'])
                    if result.get('success'):
                        trade['status'] = 'CLOSED'
                        trade['close_time'] = datetime.now().isoformat()
                        close_results.append({'trade_id': trade_id, 'success': True})
        
        logger.info(f"Signal closed: {signal_id} - {len(close_results)} trades closed")
        return {
            'success': True,
            'signal_id': signal_id,
            'trades_closed': len(close_results)
        }
    
    def sync_stop_loss_take_profit(self, signal_id, stop_loss=None, take_profit=None):
        """
        Update stop loss and take profit for all open positions in a signal
        
        Args:
            signal_id: Signal ID
            stop_loss: New stop loss price
            take_profit: New take profit price
            
        Returns:
            dict: Update results
        """
        if signal_id not in self.signals:
            return {'success': False, 'error': f'Signal {signal_id} not found'}
        
        signal = self.signals[signal_id]
        signal['stop_loss'] = stop_loss
        signal['take_profit'] = take_profit
        
        # Update all open trades
        updates = []
        for trade_id, trade in self.trades.items():
            if trade['signal_id'] == signal_id and trade['status'] == 'OPEN':
                follower = self.followers.get(trade['follower_id'])
                bridge = self._get_bridge_for_type(follower.get('broker_type'))
                
                if bridge:
                    result = bridge.modify_position(
                        symbol=trade['symbol'],
                        stop_loss=stop_loss,
                        take_profit=take_profit
                    )
                    updates.append({'trade_id': trade_id, 'success': result.get('success')})
        
        logger.info(f"SL/TP synced for signal {signal_id}: {len(updates)} trades updated")
        return {
            'success': True,
            'signal_id': signal_id,
            'trades_updated': len(updates),
            'stop_loss': stop_loss,
            'take_profit': take_profit
        }
    
    # ============================================
    # REPORTING
    # ============================================
    
    def get_signal(self, signal_id):
        """Get signal details"""
        return self.signals.get(signal_id, {})
    
    def list_signals(self):
        """Get all signals"""
        return list(self.signals.values())
    
    def get_statistic(self):
        """Get overall statistics"""
        return {
            'total_signals': len(self.signals),
            'active_signals': len([s for s in self.signals.values() if s['status'] == 'ACTIVE']),
            'total_followers': len(self.followers),
            'active_followers': len([f for f in self.followers.values() if f.get('active')]),
            'total_trades': len(self.trades),
            'open_trades': len([t for t in self.trades.values() if t['status'] == 'OPEN']),
            'closed_trades': len([t for t in self.trades.values() if t['status'] == 'CLOSED'])
        }


# Test usage
if __name__ == '__main__':
    engine = CopyTradingEngine()
    print("Copy-Trading Engine initialized")
