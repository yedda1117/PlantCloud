package com.plantcloud.calendar.dto;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonSetter;
import lombok.Data;

@Data
public class CalendarLogUpdateDTO {

    private String note;
    private String milestone;

    @JsonIgnore
    private boolean noteProvided;

    @JsonIgnore
    private boolean milestoneProvided;

    @JsonSetter("note")
    public void setNote(String note) {
        this.note = note;
        this.noteProvided = true;
    }

    @JsonSetter("milestone")
    public void setMilestone(String milestone) {
        this.milestone = milestone;
        this.milestoneProvided = true;
    }
}
