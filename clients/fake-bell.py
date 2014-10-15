import SocketServer


class BellHandler(SocketServer.BaseRequestHandler):
    def send(self, content):
        self.request.sendall(content)

    def handle(self):
        def read_line():
            line = ''
            while True:
                c = self.request.recv(1)
                line += c
                if c == '\n':
                    return line

        def read_int():
            line = read_line()
            return int(line)

        def read_bytes(size):
            content = ''
            while len(content) < size:
                t = self.request.recv(size - len(content))
                content += t

            return content

        while True:
            length = read_int()
            data = read_bytes(length)
            print data


class FakeBell(SocketServer.ThreadingMixIn, SocketServer.TCPServer):
    def __init__(self, host, port):
        self.allow_reuse_address = True

        SocketServer.TCPServer.__init__(self, (host, port), BellHandler)

    def run(self):
        self.serve_forever()

if __name__ == "__main__":
    HOST, PORT = "localhost", 8889

    FakeBell(HOST, PORT).run()
