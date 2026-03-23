
import os

file_path = 'index.html'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

start_marker = '// ===== EXPORT PREP (CC / Devoir / Composition) ====='
end_marker_next = "document.addEventListener('DOMContentLoaded', () => {"

start_index = -1
end_index = -1

for i, line in enumerate(lines):
    if start_marker in line:
        start_index = i
        break

for i, line in enumerate(lines):
    if end_marker_next in line:
        end_index = i
        break

if start_index != -1 and end_index != -1:
    print(f"Removing lines from {start_index} to {end_index - 1}")
    # Keep lines before start_index and lines starting from end_index
    new_lines = lines[:start_index] + lines[end_index:]
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.writelines(new_lines)
    print("Successfully removed export logic.")
else:
    print(f"Could not find markers. Start: {start_index}, End: {end_index}")

