package com.plantcloud.calendar.service;

import com.plantcloud.calendar.dto.CalendarLogUpdateDTO;
import com.plantcloud.calendar.vo.CalendarDayDetailVO;
import com.plantcloud.calendar.vo.CalendarSummaryVO;

import java.time.LocalDate;
import java.util.List;

public interface CalendarService {

    List<CalendarSummaryVO> getMonthView(Long plantId, Integer year, Integer month);

    CalendarDayDetailVO getDayDetail(Long plantId, LocalDate date);

    CalendarDayDetailVO updateDayLog(Long plantId, LocalDate date, CalendarLogUpdateDTO request);
}
