package com.blacknebula.scrumpoker.jira.model;

import lombok.Data;

@Data
public class Issue {
    private String expand;
    private String id;
    private String self;
    private String key;

    private IssueFields fields = new IssueFields();
}
