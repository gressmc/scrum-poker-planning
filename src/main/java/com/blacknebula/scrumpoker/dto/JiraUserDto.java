package com.blacknebula.scrumpoker.dto;

public class JiraUserDto {
    private String jiraname;
    private String token;
    private String location;

    public JiraUserDto() {
    }

    public JiraUserDto(String pJiraname, String pToken, String pLocation) {
        jiraname = pJiraname;
        token = pToken;
        location = pLocation;
    }

    public String getJiraname() {
        return jiraname;
    }

    public void setJiraname(String pJiraname) {
        jiraname = pJiraname;
    }

    public String getToken() {
        return token;
    }

    public void setToken(String pToken) {
        token = pToken;
    }

    public String getLocation() {
        return location;
    }

    public void setLocation(String pLocation) {
        location = pLocation;
    }
}
