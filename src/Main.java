import java.time.LocalDate;
import java.util.*;
import java.io.*;

public class Main {
    public static void main(String[] args) {
        System.out.println("Welcome to the Arsenal Fixture Widget!");
        ArrayList<Fixture> schedule = new ArrayList<>();
        
        String filePath = "arsenal-fixture-widget/Fixtures.csv";
                
        try (BufferedReader br = new BufferedReader(new FileReader(filePath))){

            String line;
            while ((line = br.readLine()) != null) {
                String[] biter = line.split(",");
                LocalDate date = LocalDate.parse(biter[0]);
                String team = biter[1];
                String location = biter[2];

                Fixture fixture = new Fixture(date, team, location);
                schedule.add(fixture);
            }

            for (Fixture x : schedule){
                System.out.println(x);
            }

        }catch (FileNotFoundException e) {
            System.out.println("File not found: " + filePath);
        } catch (Exception e){
            System.out.println("An error occured: " + e.getMessage());
        }
    }
}
