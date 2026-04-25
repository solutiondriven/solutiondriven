import json
import os
import sys
from datetime import datetime


CURRENT_DIR = os.path.dirname(__file__)
if CURRENT_DIR not in sys.path:
    sys.path.insert(0, CURRENT_DIR)


def respond(payload):
    sys.stdout.write(json.dumps(payload, default=str))
    sys.stdout.flush()


def read_payload():
    raw = sys.stdin.read()
    if not raw.strip():
        return {}
    return json.loads(raw)


def normalize_error(error, status="ERROR", **extra):
    payload = {
        "success": False,
        "status": status,
        "error": str(error),
        "timestamp": datetime.utcnow().isoformat() + "Z",
    }
    payload.update(extra)
    return payload


def get_broker_capabilities(broker_type):
    if broker_type == "mt5":
        return {
            "broker_type": broker_type,
            "live_execution": True,
            "live_position_management": True,
            "execution_mode": "live",
        }
    if broker_type == "binance":
        return {
            "broker_type": broker_type,
            "live_execution": True,
            "live_position_management": False,
            "execution_mode": "live",
        }
    if broker_type == "bitget":
        return {
            "broker_type": broker_type,
            "live_execution": False,
            "live_position_management": False,
            "execution_mode": "blocked",
        }
    return {
        "broker_type": broker_type,
        "live_execution": False,
        "live_position_management": False,
        "execution_mode": "unknown",
    }


def require_credentials(credentials, fields):
    missing = [field for field in fields if not credentials.get(field)]
    if missing:
        raise ValueError(f"Missing credentials: {', '.join(missing)}")


def load_bridge(broker_type):
    if broker_type == "mt5":
        from mt5_bridge import MT5Bridge

        return MT5Bridge()
    if broker_type == "binance":
        from binance_bridge import BinanceBridge

        return BinanceBridge()
    if broker_type == "bitget":
        from bitget_bridge import BitgetBridge

        return BitgetBridge()
    raise ValueError(f"Unsupported broker_type: {broker_type}")


def connect_bridge(bridge, broker_type, credentials):
    if broker_type == "mt5":
        require_credentials(credentials, ["account", "password", "server"])
        success, message = bridge.connect(
            int(credentials["account"]),
            credentials["password"],
            credentials["server"],
        )
        if not success:
            raise RuntimeError(message)
        return {"message": message}

    if broker_type == "binance":
        require_credentials(credentials, ["api_key", "api_secret"])
        result = bridge.connect(credentials["api_key"], credentials["api_secret"])
        if not result.get("success"):
            raise RuntimeError(result.get("error", "Binance connection failed"))
        return result

    if broker_type == "bitget":
        require_credentials(credentials, ["api_key", "api_secret", "passphrase"])
        raise RuntimeError(
            "Bitget live execution is blocked because this bridge is still simulated."
        )

    raise ValueError(f"Unsupported broker_type: {broker_type}")


def disconnect_bridge(bridge):
    disconnect = getattr(bridge, "disconnect", None)
    if callable(disconnect):
        try:
            disconnect()
        except Exception:
            pass


def health_check(broker_type, credentials):
    capabilities = get_broker_capabilities(broker_type)
    bridge = None
    try:
        bridge = load_bridge(broker_type)
        connect_result = connect_bridge(bridge, broker_type, credentials)

        response = {
            "success": True,
            "status": "READY",
            "timestamp": datetime.utcnow().isoformat() + "Z",
            **capabilities,
            "connection_details": connect_result,
        }

        if broker_type == "mt5":
            response["account_info"] = bridge.get_account_info()
        elif broker_type == "binance":
            response["balance_info"] = bridge.get_balance()

        return response
    finally:
        if bridge:
            disconnect_bridge(bridge)


def execute_order(broker_type, credentials, params):
    capabilities = get_broker_capabilities(broker_type)
    bridge = None
    try:
        bridge = load_bridge(broker_type)
        connect_bridge(bridge, broker_type, credentials)

        if broker_type == "mt5":
            result = bridge.execute_order(
                {
                    "symbol": params.get("symbol"),
                    "action": params.get("action"),
                    "volume": params.get("volume"),
                    "stop_loss": params.get("stop_loss"),
                    "take_profit": params.get("take_profit"),
                    "order_type": params.get("order_type", "MARKET"),
                    "price": params.get("price"),
                    "comment": params.get("comment", "Micromax live execution"),
                }
            )
        elif broker_type == "binance":
            result = bridge.execute_order(
                params.get("symbol"),
                params.get("action"),
                params.get("volume"),
                params.get("order_type", "MARKET"),
                params.get("price"),
            )
        else:
            raise RuntimeError(
                "Bitget live execution is blocked because this bridge is still simulated."
            )

        result["status"] = "FILLED" if result.get("success") else "REJECTED"
        result.update(capabilities)
        result["timestamp"] = datetime.utcnow().isoformat() + "Z"
        return result
    finally:
        if bridge:
            disconnect_bridge(bridge)


def close_position(broker_type, credentials, params):
    capabilities = get_broker_capabilities(broker_type)
    bridge = None
    try:
        bridge = load_bridge(broker_type)
        connect_bridge(bridge, broker_type, credentials)
        result = bridge.close_position(params.get("symbol"))
        result["status"] = "CLOSED" if result.get("success") else "REJECTED"
        result.update(capabilities)
        result["timestamp"] = datetime.utcnow().isoformat() + "Z"
        return result
    finally:
        if bridge:
            disconnect_bridge(bridge)


def modify_position(broker_type, credentials, params):
    capabilities = get_broker_capabilities(broker_type)
    bridge = None
    try:
        bridge = load_bridge(broker_type)
        connect_bridge(bridge, broker_type, credentials)
        result = bridge.modify_position(
            params.get("symbol"),
            params.get("stop_loss"),
            params.get("take_profit"),
        )
        result["status"] = "UPDATED" if result.get("success") else "REJECTED"
        result.update(capabilities)
        result["timestamp"] = datetime.utcnow().isoformat() + "Z"
        return result
    finally:
        if bridge:
            disconnect_bridge(bridge)


def main():
    try:
        payload = read_payload()
        broker_type = payload.get("broker_type")
        operation = payload.get("operation")
        credentials = payload.get("credentials", {})
        params = payload.get("params", {})

        if not broker_type:
            respond(normalize_error("broker_type is required", status="BAD_REQUEST"))
            return

        if operation == "health":
            respond(health_check(broker_type, credentials))
            return

        if operation == "execute_order":
            respond(execute_order(broker_type, credentials, params))
            return

        if operation == "close_position":
            respond(close_position(broker_type, credentials, params))
            return

        if operation == "modify_position":
            respond(modify_position(broker_type, credentials, params))
            return

        respond(normalize_error(f"Unsupported operation: {operation}", status="BAD_REQUEST"))
    except Exception as error:
        respond(normalize_error(error))


if __name__ == "__main__":
    main()
