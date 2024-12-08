import java.time.LocalDate;
import java.util.*;
import java.io.*;

public class Main {
    static ArrayList<Fixture> schedule = new ArrayList<>();
    public static void main(String[] args) {
        System.out.println("Welcome to the Arsenal Fixture Widget!");
        

        @SuppressWarnings("resource")
        Scanner scanner = new Scanner(System.in);
        System.out.print("Search for oppnonent fixture: ");
        
        String opponent = scanner.nextLine();
        fileReader("arsenal-fixture-widget/Fixtures.csv");
        searchOpponent(schedule, opponent);
        
                
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
            System.out.println("No fixtures available");
            return;
        }
        boolean found = false;
        for (Fixture games : schedule){
            if (games.team.equalsIgnoreCase(opponent)){
                System.out.println(games);
                found = true;
            }
        }
        if (!found){
            
                System.out.println("No Fixtures found for given opponent: " + opponent);
        }
    }
}