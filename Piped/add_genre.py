import pandas as pd

# 1. Load your file
# Adjust the encoding if you have issues, 'latin1' handles common special characters
df = pd.read_csv('deepdives.csv', encoding='latin1')

# 2. Define your Genre Mapping
# Add or update channels here as needed
genre_map = {
    'Ahoy': 'Gaming/History',
    'Coffeezilla': 'Investigative/Finance',
    'Al Jazeera English': 'News/Documentary',
    'Folding Ideas': 'Video Essay/Film',
    'ContraPoints': 'Video Essay/Culture',
    'Jacob Geller': 'Video Essay/Culture',
    'DW Documentary': 'Documentary',
    'FRONTLINE PBS | Official': 'Documentary/News',
    'MrBallen': 'True Crime/Storytelling',
    'That Chapter': 'True Crime',
    'VICE': 'Documentary/Journalism',
    'Tom Scott': 'Education',
    'Johnny Harris': 'Documentary/Geopolitics',
    'Fall of Civilizations': 'History',
    'Kings and Generals': 'History',
    'Internet Historian': 'Video Essay/History',
    'Wendover Productions': 'Documentary/Geopolitics',
    'RealLifeLore': 'Education/Geopolitics'
    # Add the rest of your channel mappings here
}

# 3. Apply the genre mapping to Column C (Unnamed: 2)
# Ensure 'channel' matches the exact column name in your CSV
df['Unnamed: 2'] = df['channel'].map(genre_map)

# 4. Filter for views > 50,000
# Assuming 'Unnamed: 4' contains the view counts as identified in your file structure
# You may need to verify which column holds the view count
df_filtered = df[df['Unnamed: 4'] > 50000]

# 5. Save the result
df_filtered.to_csv('deepdives_final.csv', index=False)

print("Process complete. Saved as 'deepdives_final.csv'.")