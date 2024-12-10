import java.time.*;
import java.util.*;
import java.util.Timer;
import java.io.*;
import javax.swing.*;
import java.awt.*;
import java.net.*;
import org.json.JSONObject;
import org.json.JSONArray;

public class APIMain {
    static ArrayList<Fixture> schedule = new ArrayList<>();
    public static void main(String[] args) {
        System.out.println("Welcome to the Arsenal Fixture Widget!");
        
        getFixturesFromApi();
        launchGUIWidget();

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
    
        // Main Panel with BorderLayout
        JPanel panel = new JPanel(new BorderLayout());
        panel.setBackground(Color.decode("#800020")); // Burgundy background
    
        // Title Label (TOP OF THE SCREEN (NORTH))
        JLabel titleLabel = new JLabel("Arsenal Fixtures", SwingConstants.CENTER);
        titleLabel.setFont(new Font("Serif", Font.BOLD, 20));
        titleLabel.setForeground(Color.decode("#FFD700")); // Gold title text
        panel.add(titleLabel, BorderLayout.NORTH); // Add title to the top

         // Next Fixture Label
         JLabel nextFixtureLabel = new JLabel();
         nextFixtureLabel.setFont(new Font("Arial", Font.BOLD, 12));
         nextFixtureLabel.setForeground(Color.decode("#FFD700")); // Gold text
         nextFixtureLabel.setHorizontalAlignment(SwingConstants.CENTER);
     
         Fixture nextFixture = getNextFixture();
         if (nextFixture != null) {
             nextFixtureLabel.setText("Next Fixture is: " + nextFixture);
         } else {
             nextFixtureLabel.setText("No upcoming Fixtures");
         }
         
         panel.add(nextFixtureLabel, BorderLayout.CENTER); // Add label to the center
    
        // Button Panel (CENTER)
        JPanel buttonPanel = new JPanel(new GridLayout(3, 1, 0, 10));
        buttonPanel.setBackground(Color.decode("#800020")); // Match background
    
        Font buttonFont = new Font("Arial", Font.PLAIN, 12);
    
        JButton refreshButton = new JButton("Refresh");
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
        refreshButton.addActionListener(e -> {
            schedule.clear();
            getFixturesFromApi();
            Fixture updatedFixture = getNextFixture();
            if (updatedFixture != null) {
                nextFixtureLabel.setText("<html>Next Fixture:<br>" + updatedFixture + "</html>");
            } else {
                nextFixtureLabel.setText("No upcoming fixtures.");
            }
        });

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

    public static Fixture getNextFixture(){
        LocalDate today = LocalDate.now();

        for (Fixture game : schedule){
            if(game.date.isAfter(today)){
                return game;
            }
        }
        return null;
    }

    public static void getFixturesFromApi(){
        //this fetches Arsenals fixtures from the API database
        String apiURL = "https://api.football-data.org/v4/teams/57/matches?status=SCHEDULED";
        String apiKey = getApiKey();

        try {
            //set up the connection with the url
            URL url = new URL(apiURL);
            HttpURLConnection connection = (HttpURLConnection) url.openConnection();

            connection.setRequestMethod("GET"); //fetches the data
            connection.setRequestProperty("X-Auth-Token", apiKey); //to authenticate

            int responseCode = connection.getResponseCode(); //this method returns if we have access or not
            if (responseCode == HttpURLConnection.HTTP_OK){ /* /accesss granted, read the json file generated */
                BufferedReader bf = new BufferedReader(new InputStreamReader (connection.getInputStream()));
                StringBuilder response = new StringBuilder();
                String inputLine;

                while((inputLine = bf.readLine())  != null){
                    response.append(inputLine);  
                }
                bf.close();
                // Parse the JSON response
                parseFixturesJSON(response.toString());
        } else {
            System.out.println("API request failed. Response Code: " + responseCode);
        }
            } catch (Exception e){
                e.printStackTrace();
            }

        }
    public static String getApiKey() {
        try (BufferedReader br = new BufferedReader(new FileReader("api_key.txt"))) {
            return br.readLine();
        } catch (Exception e) {
            e.printStackTrace();
            return null;
        }
    }
    public static void parseFixturesJSON(String jsonResponse) {
        try {
            JSONObject jsonObject = new JSONObject(jsonResponse);
            JSONArray matches = jsonObject.getJSONArray("matches");
    
            for (int i = 0; i < matches.length(); i++) {
                JSONObject match = matches.getJSONObject(i);
    
                  // Extract relevant fields
                String date = match.getString("utcDate").split("T")[0]; // Example: "2024-12-11T20:00:00Z"
                String time = match.getString("utcDate").split("T")[1].split("Z")[0]; // Extract time

            // Check for undecided time and set to "TBD"
                if (time.equals("00:00:00")) {
                    time = "TBD";
                    } else {
                        // Optional: Convert UTC time to local time
                        LocalTime localTime = LocalTime.parse(time); // Parse the UTC time
                        ZoneId zoneId = ZoneId.systemDefault(); // Get the system's default timezone
                        ZonedDateTime utcDateTimeZoned = ZonedDateTime.of(LocalDate.parse(date), localTime, ZoneId.of("UTC"));
                        ZonedDateTime localDateTimeZoned = utcDateTimeZoned.withZoneSameInstant(zoneId);
                        time = localDateTimeZoned.toLocalTime().toString(); // Convert to local time as a string
                    }

                // Extract teams
                JSONObject homeTeam = match.getJSONObject("homeTeam");
                JSONObject awayTeam = match.getJSONObject("awayTeam");
                String homeTeamName = homeTeam.getString("name");
                String awayTeamName = awayTeam.getString("name");
    
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
    
                // Create Fixture object and add to the schedule
                Fixture fixture = new Fixture(LocalDate.parse(date), opponent, location, competition, time);
                schedule.add(fixture);

            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
    
    
}