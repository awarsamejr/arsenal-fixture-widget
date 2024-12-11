# Arsenal Fixture Widget ⚽️

The Arsenal Fixture Widget is a desktop app 🖥️ that shows Arsenal's upcoming fixtures 📅 in a user-friendly GUI. It uses the Football Data API 🌐 to fetch live data 📊 and offers features like viewing fixtures, searching opponents, and refreshing data 🔄.

## Why This Program Was Created ❓

As an Arsenal fan ❤️⚪️🔴, staying updated with the team's fixtures can be both exciting 🎉 and challenging 😅. This widget provides an easy and elegant way to track Arsenal's matches 🏟️ without relying on websites 🌍 or apps 📱. The aim was to build a widget that delivers real-time ⚡ updates, lets you search by opponents, and refreshes data seamlessly.

## Features ✨

- **Live Fixture Data** 📅: Fetch Arsenal's matches directly from the API 🌐.
- **Today's Fixture**: See matches scheduled for today ⏰.
- **Next Fixture**: Highlights the next match 🥅 after today.
- **Search by Opponent** 🔍: Find fixtures against a specific team 🏆.
- **Always-On-Top Widget** 📌: Stay on top for quick access.
- **Refresh Data** 🔄: Fetch the latest updates anytime.

## Requirements 🛠️

- **Java JDK 11** or later ☕
- Internet connection for API calls 🌐

## Setup Instructions 📖

### Step 1: Clone the Repository 🗂️

```bash
git clone https://github.com/<your-repo-name>/arsenal-fixture-widget.git
cd arsenal-fixture-widget
```

### Step 2: Add Your API Key 🔑

1. Sign up at [Football Data](https://www.football-data.org/pricing).
2. Copy your API key 🔑 from the dashboard.
3. Save it in a file named `api_key.txt` in the root directory 📁.

### Step 3: Create the Manifest File 📜

Add a file `MANIFEST.MF` with:

```plaintext
Main-Class: APIMain
Class-Path: lib/json-20240303.jar
```

### Step 4: Compile & Run 🏃‍♂️

#### Compile Source Code 💻

```bash
javac -cp "lib/json-20240303.jar" -d bin src/*.java
```

#### Create JAR File 🏗️

```bash
jar cfm arsenal-widget.jar MANIFEST.MF -C bin .
```

#### Run JAR File 🚀

```bash
java -jar arsenal-widget.jar
```

## What is a Manifest File? 📜

The `MANIFEST.MF` is part of the JAR file and specifies:

- `Main-Class`: Entry point 🏁 (`APIMain`).
- `Class-Path`: Dependencies 🌟 (`json-20240303.jar`).

## File Structure 🗂️

```plaintext
.
├── lib
│   └── json-20240303.jar       # JSON library 🗂️
├── src
│   ├── APIMain.java           # Main entry 🏁
│   ├── Fixture.java           # Data model 📄
├── api_key.txt                # API key 🔑
├── arsenal_cannon.png         # App icon 🖼️
├── README.md                  # Documentation 📚
├── MANIFEST.MF                # JAR setup 📜
```

## Development 🛠️

### Run Locally 🚀

```bash
java -cp "lib/json-20240303.jar;bin" APIMain
```

### Improvements 🚀

- **Live Scores** 📊: Needs a paid API 🔑.
- **Player Stats** 👤: Add detailed stats.
- **Match Results** ⚽: Post-match updates.
- **Competition Stats** 🏆: League standings 📈.
- **Notifications** 🔔: For upcoming fixtures.
- **Multi-Team Support** 🏟️: Expand to other teams.

## Contributions 🤝

Fork, tweak, and submit PRs 📬! Everyone is welcome 🌍.

## Acknowledgments 🙌

- [Football Data API](https://www.football-data.org/) for live data 📊.
- Arsenal FC ❤️⚪️🔴 for being an inspiration and the best team!
