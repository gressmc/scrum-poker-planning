package com.blacknebula.scrumpoker.jira;

import com.blacknebula.scrumpoker.jira.model.Issue;
import org.jboss.resteasy.client.jaxrs.ResteasyWebTarget;

public class JiraControllerImpl implements JiraController {

    private JiraController jiraController =  null;

    public JiraControllerImpl(ResteasyWebTarget target) {
        super();
        jiraController = target.proxy(JiraController.class);
    }

    @Override
    public Issue findIssue(String issueId) {
        return jiraController.findIssue(issueId);
    }
}