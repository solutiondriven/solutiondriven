"""
MT5Bridge - Universal MT5 Integration
Works with ANY broker that uses MetaTrader 5

Supported Brokers:
- Exness (Exness-Real2, Exness-Demo)
- IC Markets (ICMarkets-Demo01, ICMarkets-Live)
- Pepperstone (Pepperstone-Demo, Pepperstone-Live)
- FXOpen (FXOpen-Demo, FXOpen-Real)
- And 500+ other MT5 brokers
"""

import MetaTrader5 as mt5
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class MT5Bridge:
    """
    Universal MT5 adapter - single integration for any MT5 broker
    """
    
    def __init__(self):
        self.connected = False
        self.account_info = None
        self.server = None
        self.account = None
        
    def connect(self, account: int, password: str, server: str) -> Tuple[bool, str]:
        """
        Connect to ANY MT5 broker
        
        Args:
            account: Account number
            password: Account password
            server: Broker server name
                Examples:
                - "Exness-Real2" (Exness real account)
                - "Exness-Demo" (Exness demo)
                - "ICMarkets-Demo01" (IC Markets demo)
                - "Pepperstone-Demo" (Pepperstone demo)
                - "FXOpen-Real" (FXOpen real)
        
        Returns:
            (success: bool, message: str)
        """
        try:
            # Initialize MT5
            if not mt5.initialize():
                error_code = mt5.last_error()
                msg = f"MT5 initialize failed: {error_code}"
                logger.error(msg)
                return False, msg
            
            # Attempt login to specific broker server
            authorized = mt5.login(account, password, server)
            
            if not authorized:
                error = mt5.last_error()
                msg = f"Login failed for {server}:{account} - Error: {error}"
                logger.error(msg)
                mt5.shutdown()
                return False, msg
            
            # Get account info
            self.account_info = mt5.account_info()
            if self.account_info is None:
                msg = "Failed to get account info"
                logger.error(msg)
                return False, msg
            
            self.connected = True
            self.server = server
            self.account = account
            
            msg = f"✅ Connected to {server} | Account: {account} | Balance: {self.account_info.balance}"
            logger.info(msg)
            return True, msg
            
        except Exception as e:
            msg = f"Connection error: {str(e)}"
            logger.error(msg)
            return False, msg
    
    def disconnect(self) -> bool:
        """Disconnect from MT5"""
        if self.connected:
            mt5.shutdown()
            self.connected = False
            logger.info("Disconnected from MT5")
            return True
        return False
    
    def is_connected(self) -> bool:
        """Check if connected"""
        return self.connected
    
    def execute_order(self, order_data: Dict) -> Dict:
        """
        Execute a trade order on any MT5 broker
        
        Args:
            order_data: {
                'symbol': 'EURUSD',
                'action': 'BUY' | 'SELL',
                'volume': 1.0,
                'stop_loss': 1.0850,
                'take_profit': 1.1050,
                'comment': 'Strategy signal',
                'order_type': 'MARKET' | 'LIMIT',
                'price': 1.1000 (optional for LIMIT orders)
            }
        
        Returns:
            {
                'success': bool,
                'order_id': int,
                'symbol': str,
                'action': str,
                'volume': float,
                'price': float,
                'error': str (if failed)
            }
        """
        if not self.connected:
            return {
                'success': False,
                'error': 'Not connected to MT5'
            }
        
        try:
            symbol = order_data.get('symbol')
            action = order_data.get('action', 'BUY').upper()
            volume = order_data.get('volume', 1.0)
            stop_loss = order_data.get('stop_loss')
            take_profit = order_data.get('take_profit')
            comment = order_data.get('comment', 'Micromax Trade')
            order_type = order_data.get('order_type', 'MARKET').upper()
            
            # Validate input
            if not symbol or not action:
                return {'success': False, 'error': 'Missing symbol or action'}
            
            if action not in ['BUY', 'SELL']:
                return {'success': False, 'error': 'Action must be BUY or SELL'}
            
            # Get current tick data
            tick = mt5.symbol_info_tick(symbol)
            if tick is None:
                return {
                    'success': False,
                    'error': f'Symbol {symbol} not found or not available'
                }
            
            # Determine order type and price
            if order_type == 'MARKET':
                price = tick.ask if action == 'BUY' else tick.bid
                type_enum = mt5.ORDER_TYPE_BUY if action == 'BUY' else mt5.ORDER_TYPE_SELL
            else:
                price = order_data.get('price', tick.ask if action == 'BUY' else tick.bid)
                type_enum = mt5.ORDER_TYPE_BUY_LIMIT if action == 'BUY' else mt5.ORDER_TYPE_SELL_LIMIT
            
            # Build order request
            request = {
                'action': mt5.TRADE_ACTION_DEAL,
                'symbol': symbol,
                'volume': float(volume),
                'type': type_enum,
                'price': float(price),
                'comment': comment,
                'type_time': mt5.ORDER_TIME_GTC,
                'type_filling': mt5.ORDER_FILLING_IOC
            }
            
            # Add stop loss and take profit if provided
            if stop_loss:
                request['sl'] = float(stop_loss)
            if take_profit:
                request['tp'] = float(take_profit)
            
            # Send order
            result = mt5.order_send(request)
            
            if result.retcode != mt5.TRADE_RETCODE_DONE:
                return {
                    'success': False,
                    'error': f'Order failed: {result.comment}',
                    'retcode': result.retcode
                }
            
            logger.info(f"Order executed: {symbol} {action} {volume} @ {price}")
            
            return {
                'success': True,
                'order_id': result.order,
                'symbol': symbol,
                'action': action,
                'volume': volume,
                'price': price,
                'stop_loss': stop_loss,
                'take_profit': take_profit,
                'timestamp': datetime.now().isoformat()
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': f'Execution error: {str(e)}'
            }
    
    def get_position(self, symbol: str) -> Optional[Dict]:
        """
        Get current position for a symbol
        
        Returns:
            {
                'symbol': 'EURUSD',
                'type': 'BUY' | 'SELL',
                'volume': 1.0,
                'entry_price': 1.1000,
                'current_price': 1.1010,
                'profit': 10.0,
                'profit_percent': 0.09,
                'stop_loss': 1.0850,
                'take_profit': 1.1050,
                'open_time': '2026-04-05T10:00:00'
            }
        """
        if not self.connected:
            return None
        
        try:
            positions = mt5.positions_get(symbol=symbol)
            
            if not positions:
                return None
            
            pos = positions[0]
            tick = mt5.symbol_info_tick(symbol)
            
            if tick is None:
                current_price = pos.price_open
            else:
                current_price = tick.bid if pos.type == 0 else tick.ask
            
            profit = pos.profit
            profit_percent = (profit / (pos.price_open * pos.volume)) * 100 if pos.price_open > 0 else 0
            
            return {
                'symbol': pos.symbol,
                'type': 'BUY' if pos.type == 0 else 'SELL',
                'volume': pos.volume,
                'entry_price': pos.price_open,
                'current_price': current_price,
                'profit': profit,
                'profit_percent': profit_percent,
                'stop_loss': pos.sl,
                'take_profit': pos.tp,
                'open_time': datetime.fromtimestamp(pos.time).isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error getting position: {str(e)}")
            return None
    
    def get_all_positions(self) -> List[Dict]:
        """
        Get all open positions
        
        Returns:
            List of position dicts
        """
        if not self.connected:
            return []
        
        try:
            positions = mt5.positions_get()
            
            if not positions:
                return []
            
            result = []
            for pos in positions:
                tick = mt5.symbol_info_tick(pos.symbol)
                
                if tick is None:
                    current_price = pos.price_open
                else:
                    current_price = tick.bid if pos.type == 0 else tick.ask
                
                profit = pos.profit
                profit_percent = (profit / (pos.price_open * pos.volume)) * 100 if pos.price_open > 0 else 0
                
                result.append({
                    'symbol': pos.symbol,
                    'type': 'BUY' if pos.type == 0 else 'SELL',
                    'volume': pos.volume,
                    'entry_price': pos.price_open,
                    'current_price': current_price,
                    'profit': profit,
                    'profit_percent': profit_percent,
                    'stop_loss': pos.sl,
                    'take_profit': pos.tp,
                    'open_time': datetime.fromtimestamp(pos.time).isoformat()
                })
            
            return result
            
        except Exception as e:
            logger.error(f"Error getting positions: {str(e)}")
            return []
    
    def close_position(self, symbol: str) -> Dict:
        """
        Close an open position for a symbol
        
        Returns:
            {
                'success': bool,
                'closed_price': float,
                'closed_time': str,
                'error': str (if failed)
            }
        """
        if not self.connected:
            return {'success': False, 'error': 'Not connected'}
        
        try:
            positions = mt5.positions_get(symbol=symbol)
            
            if not positions:
                return {'success': False, 'error': f'No position for {symbol}'}
            
            pos = positions[0]
            tick = mt5.symbol_info_tick(symbol)
            
            if tick is None:
                return {'success': False, 'error': f'Cannot get price for {symbol}'}
            
            # Create opposite order to close
            request = {
                'action': mt5.TRADE_ACTION_DEAL,
                'symbol': symbol,
                'volume': pos.volume,
                'type': mt5.ORDER_TYPE_SELL if pos.type == 0 else mt5.ORDER_TYPE_BUY,
                'price': tick.bid if pos.type == 0 else tick.ask,
                'comment': 'Position closed',
                'type_time': mt5.ORDER_TIME_GTC,
                'type_filling': mt5.ORDER_FILLING_IOC
            }
            
            result = mt5.order_send(request)
            
            if result.retcode != mt5.TRADE_RETCODE_DONE:
                return {
                    'success': False,
                    'error': f'Close failed: {result.comment}'
                }
            
            logger.info(f"Position closed: {symbol}")
            
            return {
                'success': True,
                'closed_price': tick.bid if pos.type == 0 else tick.ask,
                'closed_time': datetime.now().isoformat()
            }
            
        except Exception as e:
            return {'success': False, 'error': f'Close error: {str(e)}'}
    
    def modify_position(self, symbol: str, stop_loss: float = None, take_profit: float = None) -> Dict:
        """
        Modify stop loss and/or take profit for a position
        """
        if not self.connected:
            return {'success': False, 'error': 'Not connected'}
        
        try:
            positions = mt5.positions_get(symbol=symbol)
            
            if not positions:
                return {'success': False, 'error': f'No position for {symbol}'}
            
            pos = positions[0]
            
            # Update position
            request = {
                'action': mt5.TRADE_ACTION_SLTP,
                'position': pos.ticket,
                'symbol': symbol,
                'sl': float(stop_loss) if stop_loss else pos.sl,
                'tp': float(take_profit) if take_profit else pos.tp
            }
            
            result = mt5.order_send(request)
            
            if result.retcode != mt5.TRADE_RETCODE_DONE:
                return {'success': False, 'error': f'Modify failed: {result.comment}'}
            
            logger.info(f"Position modified: {symbol} SL={stop_loss} TP={take_profit}")
            
            return {
                'success': True,
                'symbol': symbol,
                'stop_loss': stop_loss,
                'take_profit': take_profit
            }
            
        except Exception as e:
            return {'success': False, 'error': f'Modify error: {str(e)}'}
    
    def get_account_info(self) -> Optional[Dict]:
        """
        Get account information
        
        Returns:
            {
                'account': 123456,
                'balance': 10000.00,
                'equity': 10500.00,
                'profit': 500.00,
                'margin': 1000.00,
                'margin_free': 9500.00,
                'margin_level': 1050.0,
                'currency': 'USD',
                'company': 'Broker Name'
            }
        """
        if not self.connected:
            return None
        
        try:
            info = mt5.account_info()
            
            if info is None:
                return None
            
            return {
                'account': info.login,
                'balance': round(info.balance, 2),
                'equity': round(info.equity, 2),
                'profit': round(info.profit, 2),
                'margin': round(info.margin, 2),
                'margin_free': round(info.margin_free, 2),
                'margin_level': round(info.margin_level, 2),
                'currency': info.currency,
                'company': info.company
            }
            
        except Exception as e:
            logger.error(f"Error getting account info: {str(e)}")
            return None
    
    def get_trade_history(self, days: int = 7) -> List[Dict]:
        """
        Get trade history for the past N days
        
        Returns:
            List of closed and open trades
        """
        if not self.connected:
            return []
        
        try:
            from_date = datetime.now() - timedelta(days=days)
            deals = mt5.history_deals_get(from_date, datetime.now())
            
            if not deals:
                return []
            
            result = []
            for deal in deals:
                result.append({
                    'ticket': deal.ticket,
                    'symbol': deal.symbol,
                    'type': 'BUY' if deal.type == 0 else 'SELL',
                    'entry_time': datetime.fromtimestamp(deal.time).isoformat(),
                    'volume': deal.volume,
                    'price': deal.price,
                    'profit': deal.profit,
                    'comment': deal.comment
                })
            
            return result
            
        except Exception as e:
            logger.error(f"Error getting history: {str(e)}")
            return []
    
    def get_symbol_info(self, symbol: str) -> Optional[Dict]:
        """Get information about a trading symbol"""
        if not self.connected:
            return None
        
        try:
            info = mt5.symbol_info(symbol)
            
            if info is None:
                return None
            
            tick = mt5.symbol_info_tick(symbol)
            
            return {
                'symbol': info.name,
                'bid': tick.bid if tick else None,
                'ask': tick.ask if tick else None,
                'spread': (tick.ask - tick.bid) if tick else None,
                'point': info.point,
                'digits': info.digits,
                'description': info.description
            }
            
        except Exception as e:
            logger.error(f"Error getting symbol info: {str(e)}")
            return None


# Example usage and testing
if __name__ == '__main__':
    bridge = MT5Bridge()
    
    # Connect to Exness demo (example)
    # You need to provide real credentials
    success, msg = bridge.connect(
        account=123456,  # Replace with real account
        password='password',  # Replace with real password
        server='Exness-Demo'
    )
    
    print(msg)
    
    if success:
        # Get account info
        info = bridge.get_account_info()
        print(f"Account info: {json.dumps(info, indent=2)}")
        
        # Execute a test order
        # order = bridge.execute_order({
        #     'symbol': 'EURUSD',
        #     'action': 'BUY',
        #     'volume': 0.1,
        #     'stop_loss': 1.0850,
        #     'take_profit': 1.1050
        # })
        # print(f"Order result: {json.dumps(order, indent=2)}")
        
        # Get positions
        positions = bridge.get_all_positions()
        print(f"Positions: {json.dumps(positions, indent=2)}")
        
        bridge.disconnect()
