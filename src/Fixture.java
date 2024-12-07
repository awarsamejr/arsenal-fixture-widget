import java.time.LocalDate;

public class Fixture {
    LocalDate date;
    String team;
    String location;

    public Fixture(LocalDate date, String team, String location){
        this.date = date;
        this.team = team;
        this.location = location;
    }

    @Override
    public String toString(){
        return date + " - " + team + " (" + location + ") ";
    }
}
