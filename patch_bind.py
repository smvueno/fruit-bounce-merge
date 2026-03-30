import re

with open('services/GameEngine.ts', 'r') as f:
    content = f.read()

# Did we accidentally remove onPointerDown, etc?
print("onPointerDown present: ", "onPointerDown" in content)
print("update present: ", "update(" in content)
