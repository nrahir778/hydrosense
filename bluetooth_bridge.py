#!/usr/bin/env python3
"""
HydroSense HC-05 Bluetooth SPP to WebSocket Bridge
===================================================
Bridges HC-05 Bluetooth Classic (SPP 9600 Baud) to a local WebSocket server (ws://0.0.0.0:8088).
This allows the Netlify web app (or any browser) to communicate with HC-05 without browser limitations.

Usage:
------
1. Pair HC-05 with your computer or Android phone (PIN: 1234 or 0000).
2. Install required packages (if not already installed):
   pip install websockets pyserial
3. Run the bridge:
   python bluetooth_bridge.py [COM_PORT_OR_MAC] [BAUD_RATE]

Examples:
- Windows:   python bluetooth_bridge.py COM4 9600
- Linux/Mac: python bluetooth_bridge.py /dev/rfcomm0 9600
- Auto-detect: python bluetooth_bridge.py
"""

import sys
import time
import asyncio
import threading
from typing import Set

# Try importing dependencies
try:
    import serial
    import serial.tools.list_ports
except ImportError:
    print("[ERROR] 'pyserial' is not installed.")
    print("Please install it with: pip install pyserial")
    sys.exit(1)

try:
    import websockets
except ImportError:
    print("[ERROR] 'websockets' is not installed.")
    print("Please install it with: pip install websockets")
    sys.exit(1)

WS_PORT = 8088
DEFAULT_BAUD = 9600

connected_clients: Set[websockets.WebSocketServerProtocol] = set()
ser = None
serial_lock = threading.Lock()
running = True

def find_hc05_port():
    """Attempt to auto-detect HC-05 or Bluetooth serial port."""
    ports = serial.tools.list_ports.comports()
    for port in ports:
        desc = (port.description or "").lower()
        hwid = (port.hwid or "").lower()
        if "hc-05" in desc or "bluetooth" in desc or "bt" in desc or "rfcomm" in desc:
            return port.device
    if ports:
        return ports[0].device
    return None

def serial_reader_thread(port_name: str, baud: int, loop: asyncio.AbstractEventLoop):
    """Background thread to read serial stream and broadcast to WebSocket clients."""
    global ser, running
    buffer = ""

    while running:
        try:
            print(f"[SERIAL] Connecting to {port_name} at {baud} baud...")
            with serial_lock:
                ser = serial.Serial(port_name, baud, timeout=1.0)
            print(f"[SERIAL] Connected to {port_name}! Telemetry stream active.")

            while running and ser and ser.is_open:
                try:
                    data = ser.read(ser.in_waiting or 1)
                    if data:
                        text = data.decode('utf-8', errors='ignore')
                        buffer += text
                        while '\n' in buffer:
                            line, buffer = buffer.split('\n', 1)
                            clean_line = line.strip()
                            if clean_line:
                                print(f"[RX HC-05] {clean_line}")
                                # Broadcast to connected WebSocket clients
                                asyncio.run_coroutine_threadsafe(
                                    broadcast_message(clean_line),
                                    loop
                                )
                except Exception as read_err:
                    print(f"[SERIAL] Read error: {read_err}")
                    break

        except Exception as conn_err:
            print(f"[SERIAL] Connection error: {conn_err}")
            time.sleep(3)
        finally:
            with serial_lock:
                if ser:
                    try:
                        ser.close()
                    except:
                        pass
                    ser = None
            if running:
                print("[SERIAL] Disconnected. Reconnecting in 3 seconds...")
                time.sleep(3)

async def broadcast_message(message: str):
    """Send telemetry line to all connected web app clients."""
    if not connected_clients:
        return
    dead_clients = set()
    for ws in list(connected_clients):
        try:
            await ws.send(message)
        except Exception:
            dead_clients.add(ws)
    for dead in dead_clients:
        connected_clients.discard(dead)

async def ws_handler(websocket, path):
    """Handle WebSocket connections from the Netlify web app."""
    client_ip = websocket.remote_address[0] if websocket.remote_address else "unknown"
    print(f"[WS] Web App connected from {client_ip}")
    connected_clients.add(websocket)

    # Send initial greeting
    try:
        await websocket.send("INFO:Connected to HydroSense Bluetooth Bridge")
    except:
        pass

    try:
        async for message in websocket:
            cmd = message.strip()
            print(f"[TX WEB -> HC-05] {cmd}")
            with serial_lock:
                if ser and ser.is_open:
                    ser.write((cmd + '\n').encode('utf-8'))
                    ser.flush()
                else:
                    await websocket.send("ERROR:HC-05 serial port is not currently connected")
    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        connected_clients.discard(websocket)
        print(f"[WS] Web App disconnected from {client_ip}")

async def main():
    port_name = sys.argv[1] if len(sys.argv) > 1 else find_hc05_port()
    baud = int(sys.argv[2]) if len(sys.argv) > 2 else DEFAULT_BAUD

    if not port_name:
        print("[ERROR] No serial/COM ports found!")
        print("Please pair HC-05 via Bluetooth in your OS settings first, or specify port: python bluetooth_bridge.py COM4 9600")
        sys.exit(1)

    print("=" * 60)
    print("HydroSense HC-05 Bluetooth SPP -> WebSocket Bridge")
    print(f"Target Serial Port: {port_name} (Baud: {baud})")
    print(f"WebSocket Server:   ws://0.0.0.0:{WS_PORT}")
    print("=" * 60)

    loop = asyncio.get_running_loop()

    # Start serial reading thread
    reader_thread = threading.Thread(
        target=serial_reader_thread,
        args=(port_name, baud, loop),
        daemon=True
    )
    reader_thread.start()

    # Start WebSocket server
    async with websockets.serve(ws_handler, "0.0.0.0", WS_PORT):
        print(f"[WS] Listening for web app connections on ws://localhost:{WS_PORT} ...")
        await asyncio.Future()  # Run forever

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n[STOP] Shutting down Bluetooth Bridge.")
        running = False
