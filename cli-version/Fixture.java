import java.time.LocalDate;

public class Fixture {
    LocalDate date;
    String team;
    String location;
    String competition;
    String time;

    public Fixture(LocalDate date, String team, String location, String competition, String time){
        this.date = date;
        this.team = team;
        this.location = location;
        this.competition = competition;
        this.time = time;

    }

    @Override
    public String toString(){
        return date + " - " + team + " (" + location + ") " + " - " + competition + " - " + time;
    }
}
