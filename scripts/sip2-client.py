#!/usr/bin/env python3
"""Independent SIP2 SC client (stdlib only) for interoperability testing."""
import argparse
import json
import socket
import ssl
import sys
import time

VERSION = "2.00"

RESPONSE_FIXED: dict[str, list[int]] = {
    "98": [1, 1, 1, 1, 1, 1, 3, 3, 18, 4],
    "94": [1],
    "24": [14, 3, 18],
    "64": [14, 3, 18, 4, 4, 4, 4, 4, 4],
    "18": [2, 2, 2, 18],
    "12": [1, 1, 1, 1, 18],
    "30": [1, 1, 1, 1, 18],
    "10": [1, 1, 1, 1, 18],
    "36": [1, 18],
    "66": [1, 4, 4, 18],
    "26": [14, 3, 18],
    "16": [1, 2, 2, 18],
    "20": [1, 18],
    "38": [1, 18],
    "96": [],
    "99": [1, 3, 4],
    "93": [1, 1],
    "23": [3, 18],
    "63": [3, 18, 10],
    "17": [18],
    "11": [1, 1, 18, 18],
    "09": [1, 18, 18],
    "29": [1, 1, 18, 18],
    "35": [18],
    "01": [1, 18],
    "25": [18],
    "65": [18],
    "15": [1, 18],
    "19": [18],
    "37": [18, 2, 2, 3],
    "97": [],
}

OK_CODES = {"94", "12", "10", "30", "20", "38", "26"}

EXPECTED_RESPONSE = {
    "status": "98",
    "login": "94",
    "patron-status": "24",
    "patron-info": "64",
    "item": "18",
    "checkout": "12",
    "checkin": "10",
    "renew": "30",
    "end-session": "36",
}


def checksum(data: str) -> str:
    total = 0
    for ch in data:
        total = (total + ord(ch)) & 0xFFFF
    return f"{(-total) & 0xFFFF:04X}"


def sip2_now() -> str:
    t = time.localtime()
    return time.strftime("%Y%m%d", t) + "    " + time.strftime("%H%M%S", t)


def build(code: str, fixed: str, fields: list[tuple[str, str]], seq: int | None) -> str:
    msg = code + fixed
    for fid, value in fields:
        msg += f"{fid}{value}|"
    if seq is not None:
        msg += f"AY{seq}"
    msg += "AZ" + checksum(msg + "AZ")
    return msg + "\r"


def parse_response(raw: str) -> dict:
    msg = raw.rstrip("\r\n")
    checksum_ok = None
    if len(msg) >= 6 and msg[-6:-4] == "AZ":
        checksum_ok = checksum(msg[:-6] + "AZ") == msg[-4:].upper()
        msg = msg[:-6]
    code = msg[:2]
    fixed_values: list[str] = []
    rest = msg[2:]
    for length in RESPONSE_FIXED.get(code, []):
        if len(rest) < length:
            break
        fixed_values.append(rest[:length])
        rest = rest[length:]
    fields: dict[str, list[str]] = {}
    i = 0
    while i + 3 <= len(rest):
        fid = rest[i : i + 2]
        if not (fid[0].isalpha() and fid[1].isalnum()):
            break
        delim = rest.find("|", i + 2)
        if delim == -1:
            break
        fields.setdefault(fid, []).append(rest[i + 2 : delim])
        i = delim + 1
    ok = fixed_values[0] if code in OK_CODES and fixed_values else None
    return {
        "code": code,
        "ok": ok,
        "checksum_ok": checksum_ok,
        "fixed": fixed_values,
        "fields": fields,
        "raw": raw.rstrip("\r\n"),
    }


class Sip2Client:
    def __init__(self, host: str, port: int, timeout: float, use_tls: bool, insecure: bool):
        raw = socket.create_connection((host, port), timeout=timeout)
        if use_tls:
            ctx = ssl.create_default_context()
            if insecure:
                ctx.check_hostname = False
                ctx.verify_mode = ssl.CERT_NONE
            raw = ctx.wrap_socket(raw, server_hostname=host)
        self.sock = raw
        self.buf = ""
        self.seq = 0
        self.timeout = timeout

    def send(self, text: str) -> None:
        if not text.endswith("\r"):
            text += "\r"
        self.sock.sendall(text.encode("utf-8"))

    def read(self, timeout: float | None = None) -> str:
        deadline = time.time() + (timeout if timeout is not None else self.timeout)
        while True:
            cr = self.buf.find("\r")
            lf = self.buf.find("\n")
            idxs = [i for i in (cr, lf) if i != -1]
            if idxs:
                idx = min(idxs)
                frame = self.buf[:idx]
                consumed = idx + 2 if self.buf[idx : idx + 2] == "\r\n" else idx + 1
                self.buf = self.buf[consumed:]
                if frame:
                    return frame
                continue
            remaining = deadline - time.time()
            if remaining <= 0:
                raise TimeoutError("no SIP2 response within timeout")
            self.sock.settimeout(remaining)
            try:
                chunk = self.sock.recv(4096)
            except socket.timeout as exc:
                raise TimeoutError("no SIP2 response within timeout") from exc
            if not chunk:
                raise ConnectionError("connection closed by ACS")
            self.buf += chunk.decode("utf-8", "replace")

    def request(self, code: str, fixed: str, fields: list[tuple[str, str]], seq: bool = True) -> str:
        self.seq = (self.seq % 8) + 1
        self.send(build(code, fixed, fields, self.seq if seq else None))
        return self.read()

    def close(self) -> None:
        try:
            self.sock.close()
        except OSError:
            pass


def emit(result: dict, as_json: bool) -> None:
    if as_json:
        print(json.dumps(result, ensure_ascii=False))
    else:
        fields = result.get("fields", {})
        bits = [f"code={result['code']}"]
        if result.get("ok") is not None:
            bits.append(f"ok={result['ok']}")
        if result.get("checksum_ok") is not None:
            bits.append(f"checksum={'ok' if result['checksum_ok'] else 'BAD'}")
        for key in ("AF", "AH", "AA", "AB", "AJ", "AE", "BL"):
            if key in fields:
                bits.append(f"{key}={fields[key][-1]}")
        print(" ".join(bits))
        print(result["raw"])


def main() -> int:
    parser = argparse.ArgumentParser(prog="sip2-client", description="Independent SIP2 SC test client")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=6000)
    parser.add_argument("--timeout", type=float, default=10.0)
    parser.add_argument("--tls", action="store_true")
    parser.add_argument("--insecure", action="store_true", help="skip TLS certificate verification")
    parser.add_argument("--user", help="terminal login username (CN)")
    parser.add_argument("--password", help="terminal login password (CO)")
    parser.add_argument("--institution", default="ESUT")
    parser.add_argument("--json", action="store_true")
    parser.add_argument("--skip-login", action="store_true")
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("status", help="99 SC Status")
    sub.add_parser("login", help="93 Login only")
    p = sub.add_parser("patron-status", help="23 Patron Status")
    p.add_argument("--barcode", required=True)
    p = sub.add_parser("patron-info", help="63 Patron Information")
    p.add_argument("--barcode", required=True)
    p.add_argument("--summary", default="          ", help="10-char summary field")
    p = sub.add_parser("item", help="17 Item Information")
    p.add_argument("--barcode", required=True)
    p = sub.add_parser("checkout", help="11 Checkout")
    p.add_argument("--barcode", required=True)
    p.add_argument("--item", required=True)
    p = sub.add_parser("checkin", help="09 Checkin")
    p.add_argument("--item", required=True)
    p = sub.add_parser("renew", help="29 Renew")
    p.add_argument("--barcode", required=True)
    p.add_argument("--item", required=True)
    p = sub.add_parser("end-session", help="35 End Patron Session")
    p.add_argument("--barcode", default="")
    p = sub.add_parser("resend", help="97 Request ACS Resend")
    p = sub.add_parser("raw", help="send a raw message")
    p.add_argument("--message", required=True)
    p.add_argument("--expect", help="expected response code")

    args = parser.parse_args()
    if args.command not in ("status", "login", "raw") and not args.skip_login:
        if not args.user or not args.password:
            parser.error("--user and --password are required for this command (or pass --skip-login)")

    client = Sip2Client(args.host, args.port, args.timeout, args.tls, args.insecure)
    try:
        if args.command not in ("status", "raw") and not args.skip_login:
            if not args.user or not args.password:
                parser.error("--user and --password are required for this command")
            raw = client.request("93", "00", [("CN", args.user), ("CO", args.password), ("CP", "SC-TEST")])
            login = parse_response(raw)
            emit(login, args.json)
            if login["code"] != "94" or login["ok"] != "1":
                return 3
            if args.command == "login":
                return 0

        now = sip2_now()
        if args.command == "status":
            raw = client.request("99", f"0040{VERSION}", [])
            expected = "98"
        elif args.command == "login":
            raw = client.request("93", "00", [("CN", args.user or ""), ("CO", args.password or ""), ("CP", "SC-TEST")])
            expected = "94"
        elif args.command == "patron-status":
            raw = client.request("23", f"000{now}", [("AO", args.institution), ("AA", args.barcode), ("AD", "")])
            expected = "24"
        elif args.command == "patron-info":
            summary = args.summary.ljust(10)[:10]
            raw = client.request("63", f"000{now}{summary}", [("AO", args.institution), ("AA", args.barcode)])
            expected = "64"
        elif args.command == "item":
            raw = client.request("17", now, [("AO", args.institution), ("AB", args.barcode)])
            expected = "18"
        elif args.command == "checkout":
            raw = client.request(
                "11",
                f"YN{now}{'0' * 18}",
                [("AO", args.institution), ("AA", args.barcode), ("AB", args.item)],
            )
            expected = "12"
        elif args.command == "checkin":
            raw = client.request(
                "09",
                f"N{now}{now}",
                [("AP", "SC-TEST"), ("AO", args.institution), ("AB", args.item)],
            )
            expected = "10"
        elif args.command == "renew":
            raw = client.request(
                "29",
                f"NN{now}{'0' * 18}",
                [("AO", args.institution), ("AA", args.barcode), ("AB", args.item)],
            )
            expected = "30"
        elif args.command == "end-session":
            fields = [("AA", args.barcode), ("AO", args.institution)]
            raw = client.request("35", now, fields if args.barcode else [("AO", args.institution)])
            expected = "36"
        elif args.command == "resend":
            client.send(build("97", "", [], 1))
            raw = client.read()
            expected = None
        elif args.command == "raw":
            client.send(args.message)
            raw = client.read()
            expected = args.expect
        else:
            parser.error("unknown command")
            return 2

        result = parse_response(raw)
        result["response_for"] = args.command
        emit(result, args.json)
        if expected is not None and result["code"] != expected:
            return 2
        if result.get("checksum_ok") is False:
            return 4
        return 0
    except (TimeoutError, ConnectionError) as exc:
        if args.json:
            print(json.dumps({"error": str(exc)}))
        else:
            print(f"ERROR {exc}", file=sys.stderr)
        return 5
    finally:
        client.close()


if __name__ == "__main__":
    sys.exit(main())
