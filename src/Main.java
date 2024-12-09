import java.time.LocalDate;
import java.util.*;
import java.io.*;
import javax.swing.*;
import java.awt.*;

public class Main {
    static ArrayList<Fixture> schedule = new ArrayList<>();
    public static void main(String[] args) {
        System.out.println("Welcome to the Arsenal Fixture Widget!");
        
        fileReader("arsenal-fixture-widget/Fixtures.csv");
        launchGUI();
        
                
    }


    public static void fileReader(String filePath){
        try (BufferedReader br = new BufferedReader(new FileReader(filePath))){

            String line;
            while ((line = br.readLine()) != null) {
                String[] biter = line.split(",");
                LocalDate date = LocalDate.parse(biter[0]);
                String team = biter[1];
                String location = biter[2];
                String competition = biter[3];
                String time = biter[4];

                Fixture fixture = new Fixture(date, team, location, competition, time);
                schedule.add(fixture);
            }

        }catch (FileNotFoundException e) {
            System.out.println("File not found: " + filePath);
        } catch (Exception e){
            System.out.println("An error occured: " + e.getMessage());
        }
    }
    
    
    public static void searchOpponent(ArrayList<Fixture> schedule, String opponent){
        
        if (schedule.isEmpty()){
            JOptionPane.showMessageDialog(null, "No fixtures available.");
            return;
        }
        StringBuilder results = new StringBuilder();
        boolean found = false;
        for (Fixture games : schedule){
            if (games.team.equalsIgnoreCase(opponent)){
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


    public static void launchGUI() {    
        // Main Window
        JFrame frame = new JFrame("Arsenal Fixture Widget");
        frame.setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
        frame.setSize(650, 500);
        frame.setLocationRelativeTo(null);
    
        // Application Icon
        ImageIcon appIcon = new ImageIcon("arsenal-fixture-widget/arsenal_cannon.png");
        Image scaledImage = appIcon.getImage().getScaledInstance(32, 32, Image.SCALE_SMOOTH);
        frame.setIconImage(scaledImage);
    
        // Main Panel with BorderLayout
        JPanel panel = new JPanel(new BorderLayout());
        panel.setBackground(Color.decode("#800020")); // Burgundy background
    
        // Title Label (TOP OF THE SCREEN (NORTH))
        JLabel titleLabel = new JLabel("Arsenal Fixtures", SwingConstants.CENTER);
        titleLabel.setFont(new Font("Serif", Font.BOLD, 40));
        titleLabel.setBorder(BorderFactory.createEmptyBorder(20, 0, 20, 0)); //Gives the title som breathing room
        titleLabel.setForeground(Color.decode("#FFD700")); // Gold title text
        panel.add(titleLabel, BorderLayout.NORTH); // Add title to the top
    
        // Button Panel (CENTER)
        JPanel buttonPanel = new JPanel(new GridLayout(3, 1, 0, 10));
        buttonPanel.setBackground(Color.decode("#800020")); // Match background
    
        Font buttonFont = new Font("Arial", Font.PLAIN, 16);
    
        JButton viewButton = new JButton("View All Fixtures");
        viewButton.setFont(buttonFont);
        viewButton.setBackground(Color.decode("#5A001F")); // Dark Red
        viewButton.setForeground(Color.decode("#FFD700")); // Gold text
        viewButton.setOpaque(true);
        viewButton.setBorder(BorderFactory.createLineBorder(Color.decode("#FFD700"), 2));
        buttonPanel.add(viewButton);
    
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
    
        panel.add(buttonPanel, BorderLayout.CENTER); // Add button panel to the center
    
        // Next Fixture Label (BOTTOM OF THE SCREEN (SOUTH))
        JLabel nextFixtureLabel = new JLabel();
        nextFixtureLabel.setFont(new Font("Arial", Font.BOLD, 14));
        nextFixtureLabel.setForeground(Color.decode("#FFD700")); // Gold text
        nextFixtureLabel.setHorizontalAlignment(SwingConstants.CENTER);
    
        Fixture nextFixture = getNextFixture();
        if (nextFixture != null) {
            nextFixtureLabel.setText("Next Fixture is: " + nextFixture);
        } else {
            nextFixtureLabel.setText("No upcoming Fixtures");
        }
        nextFixtureLabel.setBorder(BorderFactory.createEmptyBorder(10, 0, 10, 0)); // Add spacing
        panel.add(nextFixtureLabel, BorderLayout.SOUTH); // Add label to the bottom
    
        // Action Listeners
        exitButton.addActionListener(e -> System.exit(0));
    
        viewButton.addActionListener(e -> {
            JFrame viewFrame = new JFrame("All Fixtures");
            viewFrame.setSize(600, 400);
            viewFrame.setLocationRelativeTo(null);
    
            JTextArea textArea = new JTextArea();
            for (Fixture game : schedule) {
                textArea.append(game + "\n");
            }
            viewFrame.add(new JScrollPane(textArea)); // Add scrolling
            viewFrame.setVisible(true);
        });
    
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
}
