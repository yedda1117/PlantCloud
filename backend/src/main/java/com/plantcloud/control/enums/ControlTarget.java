package com.plantcloud.control.enums;

public enum ControlTarget {
    FAN("fan"),
    LIGHT("light");

    private final String value;

    ControlTarget(String value) {
        this.value = value;
    }

    public String getValue() {
        return value;
    }
}