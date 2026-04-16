package com.plantcloud.calendar.vo;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDate;

@Data
@Builder
public class CalendarSummaryVO {

    private LocalDate date;
    private Boolean hasPhoto;
    private String thumbnailUrl;
    private String milestone;
}
