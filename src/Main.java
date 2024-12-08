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

                Fixture fixture = new Fixture(date, team, location, competition);
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
        frame.setSize(400,300);
        frame.setLocationRelativeTo(null);

        //Create a panel to hold components
        JPanel panel = new JPanel();
        panel.setLayout(new GridLayout(4, 1)); //panel som består av 4 rader og 1 kollon

        //add components
        JLabel titleLabel = new JLabel("Arsenal Fixture Widget", SwingConstants.CENTER);
        JButton viewButton = new JButton("View All Fixtures");
        JButton searchButton = new JButton("Search Opponent Fixture");
        JButton exitButton = new JButton("Exit");

        

        //action listener
        exitButton.addActionListener(e -> System.exit(0));
        
        viewButton.addActionListener(e -> {
            JFrame viewFrame = new JFrame("All Fixtures");
            viewFrame.setSize(300,200);
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
