import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


_request_ctx = threading.local()


class _RequestProxy:
    def get_json(self):
        handler = getattr(_request_ctx, "handler", None)
        if handler is None:
            raise RuntimeError("No active request context")

        length = int(handler.headers.get("Content-Length", "0") or 0)
        if length <= 0:
            return None

        raw = handler.rfile.read(length)
        if not raw:
            return None

        return json.loads(raw.decode("utf-8"))


request = _RequestProxy()


def jsonify(payload):
    return payload


class Flask:
    def __init__(self, import_name):
        self.import_name = import_name
        self._routes = {}

    def route(self, path, methods=None):
        allowed_methods = tuple((methods or ["GET"]))

        def decorator(func):
            self._routes[(path, allowed_methods)] = func
            return func

        return decorator

    def _match_route(self, path, method):
        for (route_path, methods), func in self._routes.items():
            if route_path == path and method in methods:
                return func
        return None

    def run(self, host="127.0.0.1", port=5000, debug=False):
        app = self

        class Handler(BaseHTTPRequestHandler):
            def do_GET(self):
                self._dispatch()

            def do_POST(self):
                self._dispatch()

            def log_message(self, format, *args):
                if debug:
                    super().log_message(format, *args)

            def _dispatch(self):
                view = app._match_route(self.path, self.command)
                if view is None:
                    self._send_json({"success": False, "message": "Not Found"}, 404)
                    return

                _request_ctx.handler = self
                try:
                    result = view()
                except Exception as exc:
                    self._send_json({"success": False, "message": str(exc)}, 500)
                    return
                finally:
                    _request_ctx.handler = None

                status = 200
                body = result
                if isinstance(result, tuple) and len(result) == 2:
                    body, status = result

                self._send_json(body, status)

            def _send_json(self, payload, status):
                response = json.dumps(payload, ensure_ascii=False).encode("utf-8")
                self.send_response(status)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(response)))
                self.end_headers()
                self.wfile.write(response)

        with ThreadingHTTPServer((host, port), Handler) as server:
            print(f" * Running on http://{host}:{port}")
            server.serve_forever()
