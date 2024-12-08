import java.time.LocalDate;

public class Fixture {
    LocalDate date;
    String team;
    String location;
    String competition;

    public Fixture(LocalDate date, String team, String location, String competition){
        this.date = date;
        this.team = team;
        this.location = location;
        this.competition = competition;

    }

    @Override
    public String toString(){
        return date + " - " + team + " (" + location + ") " + " - " + competition;
    }
}
