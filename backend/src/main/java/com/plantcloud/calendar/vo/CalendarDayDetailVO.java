package com.plantcloud.calendar.vo;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@Builder
public class CalendarDayDetailVO {

    private Long plantId;
    private LocalDate date;
    private String photoUrl;
    private String originPhotoUrl;
    private String note;
    private String milestone;
    private BigDecimal temperature;
    private BigDecimal humidity;
    private BigDecimal light;
    private Boolean hasPhoto;
}
