from slowapi import Limiter
from slowapi.util import get_remote_address

# Instância única, importada tanto pelo main.py (registro do middleware)
# quanto pelos routers (decorator @limiter.limit(...)) — evita import circular.
limiter = Limiter(key_func=get_remote_address)
