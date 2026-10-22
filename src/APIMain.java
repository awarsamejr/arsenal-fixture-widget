import java.time.*;
import java.util.*;
import java.io.*;
import javax.swing.*;
import java.awt.*;
import java.net.*;
import org.json.JSONObject;
import org.json.JSONArray;

public class APIMain {
    static ArrayList<Fixture> schedule = new ArrayList<>();

    // Labels are kept here so both the first load and Refresh can update them
    static JLabel todaysFixtureLabel;
    static JLabel nextFixtureLabel;
    static JButton refreshButton;

    public static void main(String[] args) {
        System.out.println("Welcome to the Arsenal Fixture Widget!");

        // Build the GUI on the Swing thread, then fetch fixtures in the background
        SwingUtilities.invokeLater(() -> {
            launchGUIWidget();
            loadFixturesInBackground();
        });
    }

    public static void searchOpponent(ArrayList<Fixture> schedule, String opponent){

        if (schedule.isEmpty()){
            JOptionPane.showMessageDialog(null, "No fixtures available.");
            return;
        }
        StringBuilder results = new StringBuilder();
        boolean found = false;
        for (Fixture games : schedule){
            if (games.team.equalsIgnoreCase(opponent.trim())){
                results.append(games).append("\n");
                found = true;
            }
        }
        if (!found){
            JOptionPane.showMessageDialog(null, "No fixtures found for opponent: " + opponent);
        } else{
            JOptionPane.showMessageDialog(null, "Results:\n" + results.toString());
        }
    }


    public static void launchGUIWidget() {
        // Main Frame
        JFrame frame = new JFrame("Arsenal Fixture Widget");

        frame.setSize(650, 200);
        frame.setLocation((Toolkit.getDefaultToolkit().getScreenSize().width - frame.getWidth()) / 2, 0);
        frame.setUndecorated(true); //removes the title bar

        // Set Application Icon (looked up next to the program, not the current folder)
        ImageIcon appIcon = new ImageIcon(appFile("arsenal_cannon.png").getPath());
        frame.setIconImage(appIcon.getImage()); // Set the icon to the JFrame

        // Main Panel with BorderLayout
        JPanel panel = new JPanel(new BorderLayout());
        panel.setBackground(Color.decode("#800020")); // Burgundy background

        // Title Label (TOP OF THE SCREEN (NORTH))
        JLabel titleLabel = new JLabel("Arsenal Fixtures", SwingConstants.CENTER);
        titleLabel.setFont(new Font("Serif", Font.BOLD, 20));
        titleLabel.setForeground(Color.decode("#FFD700")); // Gold title text
        panel.add(titleLabel, BorderLayout.NORTH); // Add title to the top

       // Create a nested panel to hold today's and next fixture labels
        JPanel fixturesPanel = new JPanel(new GridLayout(2, 1));
        fixturesPanel.setBackground(Color.decode("#800020")); // Match main panel's background

        // Today's fixture label
        todaysFixtureLabel = new JLabel("Loading fixtures...");
        todaysFixtureLabel.setFont(new Font("Arial", Font.BOLD, 12));
        todaysFixtureLabel.setForeground(Color.decode("#FFD700")); // Gold text
        todaysFixtureLabel.setHorizontalAlignment(SwingConstants.CENTER);

        // Next fixture label
        nextFixtureLabel = new JLabel("");
        nextFixtureLabel.setFont(new Font("Arial", Font.BOLD, 12));
        nextFixtureLabel.setForeground(Color.decode("#FFD700")); // Gold text
        nextFixtureLabel.setHorizontalAlignment(SwingConstants.CENTER);

        // Add labels to the nested panel
        fixturesPanel.add(todaysFixtureLabel);
        fixturesPanel.add(nextFixtureLabel);

        // Add the nested panel to the main panel
        panel.add(fixturesPanel, BorderLayout.CENTER); // Adjust placement as needed


        // Button Panel (CENTER)
        JPanel buttonPanel = new JPanel(new GridLayout(3, 1, 0, 10));
        buttonPanel.setBackground(Color.decode("#800020")); // Match background

        Font buttonFont = new Font("Arial", Font.PLAIN, 18);

        refreshButton = new JButton("Refresh");
        refreshButton.setFont(buttonFont);
        refreshButton.setBackground(Color.decode("#5A001F"));
        refreshButton.setForeground(Color.decode("#FFD700"));
        refreshButton.setOpaque(true);
        refreshButton.setBorder(BorderFactory.createLineBorder(Color.decode("#FFD700"), 2));
        buttonPanel.add(refreshButton);

        JButton searchButton = new JButton("Search Opponent Fixture");
        searchButton.setFont(buttonFont);
        searchButton.setBackground(Color.decode("#5A001F")); // Dark Red
        searchButton.setForeground(Color.decode("#FFD700")); // Gold text
        searchButton.setOpaque(true);
        searchButton.setBorder(BorderFactory.createLineBorder(Color.decode("#FFD700"), 2));
        buttonPanel.add(searchButton);

        JButton exitButton = new JButton("Exit");
        exitButton.setFont(buttonFont);
        exitButton.setBackground(Color.decode("#5A001F")); // Dark Red
        exitButton.setForeground(Color.decode("#FFD700")); // Gold text
        exitButton.setOpaque(true);
        exitButton.setBorder(BorderFactory.createLineBorder(Color.decode("#FFD700"), 2));
        buttonPanel.add(exitButton);

        panel.add(buttonPanel, BorderLayout.SOUTH); // Add button panel to the bottom


        // Action Listeners
        refreshButton.addActionListener(e -> loadFixturesInBackground());

        exitButton.addActionListener(e -> System.exit(0));

        searchButton.addActionListener(e -> {
            String opponent = JOptionPane.showInputDialog(frame, "Enter opponent to search:");
            if (opponent != null && !opponent.trim().isEmpty()) {
                searchOpponent(schedule, opponent);
            } else {
                JOptionPane.showMessageDialog(frame, "Please enter a valid opponent name.");
            }
        });

        // Add main panel to the frame
        frame.add(panel);
        frame.setVisible(true);


    }

    // Fetches fixtures off the Swing thread so the widget doesn't freeze,
    // then updates BOTH labels once the data is back.
    public static void loadFixturesInBackground() {
        refreshButton.setEnabled(false);
        todaysFixtureLabel.setText("Loading fixtures...");
        nextFixtureLabel.setText("");

        new SwingWorker<ArrayList<Fixture>, Void>() {
            @Override
            protected ArrayList<Fixture> doInBackground() {
                return getFixturesFromApi();
            }

            @Override
            protected void done() {
                ArrayList<Fixture> fixtures = null;
                try {
                    fixtures = get();
                } catch (Exception e) {
                    e.printStackTrace();
                }
                if (fixtures == null) {
                    todaysFixtureLabel.setText("Couldn't load fixtures.");
                    nextFixtureLabel.setText("Check api_key.txt and your internet connection, then press Refresh.");
                } else {
                    schedule = fixtures;
                    updateFixtureLabels();
                }
                refreshButton.setEnabled(true);
            }
        }.execute();
    }

    public static void updateFixtureLabels() {
        Fixture todaysFixture = getTodaysFixture();
        if (todaysFixture != null) {
            todaysFixtureLabel.setText("Today's Fixture is: " + todaysFixture);
        } else {
            todaysFixtureLabel.setText("No fixtures scheduled for today.");
        }

        Fixture nextFixture = getNextFixture();
        if (nextFixture != null) {
            nextFixtureLabel.setText("Next Fixture is: " + nextFixture);
        } else {
            nextFixtureLabel.setText("No upcoming fixtures.");
        }
    }

    public static Fixture getTodaysFixture() {
        LocalDate today = LocalDate.now(); // Get the current date

        for (Fixture game : schedule) {
            if (game.date.equals(today)) { // Compare fixture date with today
                return game;
            }
        }
        return null; // No fixtures for today
    }

    public static Fixture getNextFixture(){
        LocalDate today = LocalDate.now();

        for (Fixture game : schedule){
            if(game.date.isAfter(today)){
                return game;
            }
        }
        return null;
    }

    // Returns the fixtures, or null if the request failed
    public static ArrayList<Fixture> getFixturesFromApi(){
        //this fetches Arsenals fixtures from the API database
        String apiURL = "https://api.football-data.org/v4/teams/57/matches?status=SCHEDULED";
        String apiKey = getApiKey();
        if (apiKey == null || apiKey.isEmpty()) {
            System.out.println("No API key found in api_key.txt");
            return null;
        }

        try {
            //set up the connection with the url
            URI uri = new URI(apiURL);
            URL url = uri.toURL();
            HttpURLConnection connection = (HttpURLConnection) url.openConnection();

            connection.setRequestMethod("GET"); //fetches the data
            connection.setRequestProperty("X-Auth-Token", apiKey); //to authenticate
            connection.setConnectTimeout(10000);
            connection.setReadTimeout(10000);

            int responseCode = connection.getResponseCode(); //this method returns if we have access or not
            if (responseCode == HttpURLConnection.HTTP_OK){ /* /accesss granted, read the json file generated */
                StringBuilder response = new StringBuilder();
                try (BufferedReader bf = new BufferedReader(new InputStreamReader(connection.getInputStream(), "UTF-8"))) {
                    String inputLine;
                    while((inputLine = bf.readLine())  != null){
                        response.append(inputLine);
                    }
                }
                // Parse the JSON response
                return parseFixturesJSON(response.toString());
            } else {
                System.out.println("API request failed. Response Code: " + responseCode);
            }
        } catch (Exception e){
            e.printStackTrace();
        }
        return null;
    }

    public static String getApiKey() {
        try (BufferedReader br = new BufferedReader(new FileReader(appFile("api_key.txt")))) {
            String key = br.readLine();
            return key == null ? null : key.trim();
        } catch (Exception e) {
            e.printStackTrace();
            return null;
        }
    }

    // Finds a file that sits next to the program (the .jar/.exe, or the project
    // folder when running from bin/), so it works no matter where it's started from.
    public static File appFile(String name) {
        try {
            File location = new File(APIMain.class.getProtectionDomain().getCodeSource().getLocation().toURI());
            File dir = location.isDirectory() ? location : location.getParentFile();
            if (dir != null && dir.getName().equals("bin")) {
                dir = dir.getParentFile(); // running from compiled classes in bin/
            }
            if (dir != null) {
                File candidate = new File(dir, name);
                if (candidate.exists()) {
                    return candidate;
                }
            }
        } catch (Exception e) {
            // fall back to the current folder below
        }
        return new File(name);
    }

    public static ArrayList<Fixture> parseFixturesJSON(String jsonResponse) {
        ArrayList<Fixture> fixtures = new ArrayList<>();
        try {
            JSONObject jsonObject = new JSONObject(jsonResponse);
            JSONArray matches = jsonObject.getJSONArray("matches");

            for (int i = 0; i < matches.length(); i++) {
                JSONObject match = matches.getJSONObject(i);

                // Kick-off comes in UTC, e.g. "2024-12-11T20:00:00Z"
                ZonedDateTime utcKickoff = Instant.parse(match.getString("utcDate")).atZone(ZoneOffset.UTC);

                LocalDate date;
                String time;
                // The API uses 00:00 UTC when the kick-off time isn't decided yet
                if (utcKickoff.toLocalTime().equals(LocalTime.MIDNIGHT)) {
                    date = utcKickoff.toLocalDate();
                    time = "TBD";
                } else {
                    // Convert to local time; the date is converted too, since a late
                    // UTC kick-off can fall on the next day locally
                    ZonedDateTime localKickoff = utcKickoff.withZoneSameInstant(ZoneId.systemDefault());
                    date = localKickoff.toLocalDate();
                    time = localKickoff.toLocalTime().toString();
                }

                // Extract teams
                JSONObject homeTeam = match.getJSONObject("homeTeam");
                JSONObject awayTeam = match.getJSONObject("awayTeam");
                String homeTeamName = homeTeam.optString("name", "TBD");
                String awayTeamName = awayTeam.optString("name", "TBD");

                // Determine if Arsenal is the home or away team
                String location;
                String opponent;
                if (homeTeamName.contains("Arsenal")) {
                    location = "Home";
                    opponent = awayTeamName;
                } else if (awayTeamName.contains("Arsenal")) {
                    location = "Away";
                    opponent = homeTeamName;
                } else {
                    continue; // Skip matches that do not involve Arsenal
                }

                // Extract competition
                String competition = match.getJSONObject("competition").getString("name");

                // Create Fixture object and add to the list
                fixtures.add(new Fixture(date, opponent, location, competition, time));

            }
        } catch (Exception e) {
            e.printStackTrace();
        }
        return fixtures;
    }


}
