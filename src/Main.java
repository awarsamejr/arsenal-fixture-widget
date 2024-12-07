import java.time.LocalDate;
import java.util.*;

public class Main {
    public static void main(String[] args) {
        System.out.println("Welcome to the Arsenal Fixture Widget!");
        ArrayList<Fixture> schedule = new ArrayList<>();
        LocalDate fixtureDate = LocalDate.of(2024,12,9);

        Fixture LivArs = new Fixture(fixtureDate,"Liverpool","Home");

        System.out.println(LivArs);
    }
}
