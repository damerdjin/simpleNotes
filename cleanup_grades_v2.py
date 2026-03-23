
import os

file_path = 'index.html'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

start_marker = '// ===== GRADES ====='
end_marker = 'function getClassColor(className) {'

start_index = -1
end_index = -1

for i, line in enumerate(lines):
    if start_marker in line:
        start_index = i
        break

if start_index != -1:
    for i in range(start_index, len(lines)):
        if end_marker in lines[i]:
            end_index = i
            break

if start_index != -1 and end_index != -1:
    print(f"Removing lines from {start_index} to {end_index - 1}")
    new_lines = lines[:start_index] + lines[end_index:]
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.writelines(new_lines)
    print("Successfully removed grades logic.")
else:
    print(f"Could not find markers. Start: {start_index}, End: {end_index}")
