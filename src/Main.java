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


    public static void launchGUI(){    
        //Main Window
        JFrame frame = new JFrame("Arsenal Fixture Widget");
        frame.setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
        frame.setSize(500,500);
        frame.setLocationRelativeTo(null);
    
        //app icon
        ImageIcon appIcon = new ImageIcon("arsenal-fixture-widget/arsenal_cannon.png"); // Replace with your icon file
        Image scaledImage = appIcon.getImage().getScaledInstance(32, 32, Image.SCALE_SMOOTH); // Resize to 32x32
        ImageIcon scaledIcon = new ImageIcon(scaledImage);
        frame.setIconImage(scaledIcon.getImage());
    
        JPanel panel = new JPanel();
        panel.setBackground(Color.decode("#800020")); // Burgundy background
        panel.setLayout(new GridLayout(4, 1, 0, 20)); // Vertical layout
    
        JLabel titleLabel = new JLabel("Arsenal Fixtures", SwingConstants.CENTER);
        titleLabel.setFont(new Font("Serif", Font.BOLD, 40)); // Bold and large font
        titleLabel.setForeground(Color.decode("#FFD700")); // Gold title text
        titleLabel.setHorizontalTextPosition(SwingConstants.CENTER); // Center text below the badge
        titleLabel.setVerticalTextPosition(SwingConstants.BOTTOM); // Position badge above the text
        panel.add(titleLabel);
    
        Font buttonFont = new Font("Arial", Font.PLAIN, 16);
    
        JButton viewButton = new JButton("View All Fixtures");
        viewButton.setFont(buttonFont);
        viewButton.setBackground(Color.decode("#5A001F")); // Dark Red
        viewButton.setForeground(Color.decode("#FFD700")); // Gold text
        viewButton.setOpaque(true);
        viewButton.setBorder(BorderFactory.createLineBorder(Color.decode("#FFD700"), 2)); // Black border
        panel.add(viewButton);
    
        JButton searchButton = new JButton("Search Opponent Fixture");
        searchButton.setFont(buttonFont);
        searchButton.setBackground(Color.decode("#5A001F")); // Dark Red
        searchButton.setForeground(Color.decode("#FFD700")); // Gold text
        searchButton.setOpaque(true);
        searchButton.setBorder(BorderFactory.createLineBorder(Color.decode("#FFD700"), 2)); // Black border
        panel.add(searchButton);
    
        JButton exitButton = new JButton("Exit");
        exitButton.setFont(buttonFont);
        exitButton.setBackground(Color.decode("#5A001F")); // Dark Red
        exitButton.setForeground(Color.decode("#FFD700")); // Gold text
        exitButton.setOpaque(true);
        exitButton.setBorder(BorderFactory.createLineBorder(Color.decode("#FFD700"), 2)); // Black border
        panel.add(exitButton);

        //action listener
        exitButton.addActionListener(e -> System.exit(0));
        
        viewButton.addActionListener(e -> {
            JFrame viewFrame = new JFrame("All Fixtures");
            viewFrame.setSize(600,400);
            viewFrame.setLocationRelativeTo(null);

            JTextArea textArea = new JTextArea();
            for (Fixture game : schedule){
                textArea.append(game + "\n");
            }
            viewFrame.add(new JScrollPane(textArea)); // to be able to scroll
            viewFrame.setVisible(true);
        }); 

        searchButton.addActionListener(e -> {
            String opponent = JOptionPane.showInputDialog(frame, "Enter opponent to search:");
            if(opponent != null && !opponent.trim().isEmpty()){
                searchOpponent(schedule, opponent);
            } else {
                JOptionPane.showMessageDialog(frame, "Please enter a valid opponent name.");
            }
        });
        
        

        //add the componnets to the panel
        panel.add(titleLabel);
        panel.add(viewButton);
        panel.add(searchButton);
        panel.add(exitButton);

        //add the panel to the frame
        frame.add(panel);

        //make the frame visible
        frame.setVisible(true);

    }
}
