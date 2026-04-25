"""
Binance Bridge - Direct execution for crypto trading
Handles limit/market orders, position management, and P&L tracking
"""

from binance.client import Client
from binance.exceptions import BinanceAPIException
import logging

logger = logging.getLogger(__name__)


class BinanceBridge:
    """Unified interface to Binance spot trading"""
    
    def __init__(self, api_key=None, api_secret=None):
        self.client = None
        self.api_key = api_key
        self.api_secret = api_secret
        self.connected = False
        self.positions = {}  # Track open positions
        
    def connect(self, api_key, api_secret):
        """
        Connect to Binance with API credentials
        
        Args:
            api_key: Your Binance API key
            api_secret: Your Binance API secret
            
        Returns:
            dict: {'success': bool, 'message': str}
        """
        try:
            self.api_key = api_key
            self.api_secret = api_secret
            self.client = Client(api_key=api_key, api_secret=api_secret)
            
            # Test connection
            account = self.client.get_account()
            self.connected = True
            
            logger.info(f"Binance connected - Account: {account.get('accountType')}")
            return {
                'success': True,
                'message': 'Connected to Binance',
                'account_type': account.get('accountType')
            }
            
        except BinanceAPIException as e:
            logger.error(f"Binance connection failed: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
        except Exception as e:
            logger.error(f"Unexpected error connecting to Binance: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def execute_order(self, symbol, action, volume, order_type='MARKET', price=None):
        """
        Execute a market or limit order
        
        Args:
            symbol: Trading pair (e.g., 'BTCUSDT')
            action: 'BUY' or 'SELL'
            volume: Order quantity
            order_type: 'MARKET' or 'LIMIT' (default: MARKET)
            price: Required if order_type is LIMIT
            
        Returns:
            dict: Order details or error
        """
        if not self.connected:
            return {'success': False, 'error': 'Not connected to Binance'}
        
        try:
            # Convert action to Binance format
            side = 'BUY' if action.upper() == 'BUY' else 'SELL'
            
            # Execute order
            if order_type.upper() == 'MARKET':
                order = self.client.order_market(
                    symbol=symbol,
                    side=side,
                    quantity=volume
                )
            else:  # LIMIT
                if price is None:
                    return {'success': False, 'error': 'Price required for LIMIT orders'}
                order = self.client.order_limit(
                    symbol=symbol,
                    side=side,
                    timeInForce='GTC',
                    quantity=volume,
                    price=price
                )
            
            # Track position
            self.positions[symbol] = {
                'quantity': volume,
                'action': action,
                'entry_price': price or order.get('fills', [{}])[0].get('price'),
                'order_id': order.get('orderId'),
                'timestamp': order.get('transactTime')
            }
            
            logger.info(f"Order executed: {action} {volume} {symbol}")
            return {
                'success': True,
                'order_id': order.get('orderId'),
                'symbol': symbol,
                'action': action,
                'quantity': volume,
                'price': order.get('fills', [{}])[0].get('price') if order.get('fills') else price
            }
            
        except BinanceAPIException as e:
            logger.error(f"Order execution failed: {str(e)}")
            return {'success': False, 'error': str(e)}
        except Exception as e:
            logger.error(f"Unexpected error executing order: {str(e)}")
            return {'success': False, 'error': str(e)}
    
    def get_position(self, symbol):
        """
        Get current position for a symbol
        
        Args:
            symbol: Trading pair (e.g., 'BTCUSDT')
            
        Returns:
            dict: Position details or empty dict if no position
        """
        if not self.connected:
            return {}
        
        try:
            # Get current holdings
            balance = self.client.get_asset_balance(asset=symbol.replace('USDT', '').replace('BUSD', ''))
            
            if balance:
                return {
                    'symbol': symbol,
                    'quantity': float(balance.get('free', 0)),
                    'locked': float(balance.get('locked', 0)),
                    'total': float(balance.get('free', 0)) + float(balance.get('locked', 0))
                }
            return {}
            
        except Exception as e:
            logger.error(f"Error getting position: {str(e)}")
            return {}
    
    def close_position(self, symbol, quantity=None):
        """
        Close a position by selling/buying the opposite
        
        Args:
            symbol: Trading pair (e.g., 'BTCUSDT')
            quantity: Amount to close (if None, closes all)
            
        Returns:
            dict: Close order details or error
        """
        if not self.connected:
            return {'success': False, 'error': 'Not connected'}
        
        try:
            position = self.get_position(symbol)
            if not position or position['quantity'] == 0:
                return {'success': True, 'message': 'No position to close'}
            
            qty_to_close = quantity or position['quantity']
            
            # Close position with opposite action
            action = 'SELL' if position['quantity'] > 0 else 'BUY'
            
            order = self.execute_order(symbol, action, qty_to_close, 'MARKET')
            
            if order.get('success'):
                if symbol in self.positions:
                    del self.positions[symbol]
                logger.info(f"Position closed: {symbol}")
            
            return order
            
        except Exception as e:
            logger.error(f"Error closing position: {str(e)}")
            return {'success': False, 'error': str(e)}
    
    def modify_position(self, symbol, stop_loss=None, take_profit=None):
        """
        Update stop loss and/or take profit
        Note: Binance requires using OCO orders or separate stop loss orders
        
        Args:
            symbol: Trading pair
            stop_loss: Stop loss price
            take_profit: Take profit price
            
        Returns:
            dict: Updated position or error
        """
        if not self.connected:
            return {'success': False, 'error': 'Not connected'}
        
        try:
            position = self.positions.get(symbol, {})
            
            # Update tracking
            if stop_loss:
                position['stop_loss'] = stop_loss
            if take_profit:
                position['take_profit'] = take_profit
            
            self.positions[symbol] = position
            
            logger.info(f"Position updated: {symbol} SL={stop_loss} TP={take_profit}")
            return {
                'success': True,
                'symbol': symbol,
                'stop_loss': stop_loss,
                'take_profit': take_profit
            }
            
        except Exception as e:
            logger.error(f"Error modifying position: {str(e)}")
            return {'success': False, 'error': str(e)}
    
    def get_balance(self):
        """Get account balance"""
        if not self.connected:
            return {'success': False}
        
        try:
            account = self.client.get_account()
            total_balance = sum([float(asset.get('free', 0)) for asset in account.get('balances', [])])
            
            return {
                'success': True,
                'total_balance': total_balance,
                'balances': account.get('balances', [])
            }
        except Exception as e:
            logger.error(f"Error getting balance: {str(e)}")
            return {'success': False, 'error': str(e)}
    
    def disconnect(self):
        """Disconnect from Binance"""
        self.connected = False
        logger.info("Disconnected from Binance")
        return {'success': True, 'message': 'Disconnected'}


# Test usage
if __name__ == '__main__':
    bridge = BinanceBridge()
    print("Binance bridge initialized")
