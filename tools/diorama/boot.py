# Runs a gzip-compressed Blender script sent from the Pi. Piped uploads of more than about 30 KB stall on the PC's
# SSH gate, so scripts travel compressed:  blender-pc.sh script <file.py> [args...]
import gzip, sys
at = sys.argv.index('--')
script = sys.argv.pop(at + 1)
code = gzip.open(script).read().decode()
exec(compile(code, script[:-3], 'exec'), {'__name__': '__main__', '__file__': script[:-3]})
