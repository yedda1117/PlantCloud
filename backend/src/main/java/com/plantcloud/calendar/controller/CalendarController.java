package com.plantcloud.calendar.controller;

import com.plantcloud.calendar.dto.CalendarLogUpdateDTO;
import com.plantcloud.calendar.service.CalendarService;
import com.plantcloud.calendar.vo.CalendarDayDetailVO;
import com.plantcloud.calendar.vo.CalendarSummaryVO;
import com.plantcloud.common.result.Result;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;

@Validated
@RestController
@RequestMapping("/calendar")
@RequiredArgsConstructor
public class CalendarController {

    private final CalendarService calendarService;

    @GetMapping
    public Result<List<CalendarSummaryVO>> getMonthView(@RequestParam("plant_id") Long plantId,
                                                        @RequestParam @Min(value = 1, message = "year must be positive") Integer year,
                                                        @RequestParam @Min(value = 1, message = "month must be between 1 and 12")
                                                        @Max(value = 12, message = "month must be between 1 and 12") Integer month) {
        return Result.ok(calendarService.getMonthView(plantId, year, month));
    }

    @GetMapping("/{date}")
    public Result<CalendarDayDetailVO> getDayDetail(@PathVariable
                                                    @DateTimeFormat(pattern = "yyyy-MM-dd") LocalDate date,
                                                    @RequestParam("plant_id") Long plantId) {
        return Result.ok(calendarService.getDayDetail(plantId, date));
    }

    @PutMapping("/{date}")
    public Result<CalendarDayDetailVO> updateDayLog(@PathVariable
                                                    @DateTimeFormat(pattern = "yyyy-MM-dd") LocalDate date,
                                                    @RequestParam("plant_id") Long plantId,
                                                    @Valid @RequestBody CalendarLogUpdateDTO request) {
        return Result.ok(calendarService.updateDayLog(plantId, date, request));
    }
}
