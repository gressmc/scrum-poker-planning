package com.blacknebula.scrumpoker.jira;

import com.blacknebula.scrumpoker.dto.JiraUserDto;
import com.blacknebula.scrumpoker.jira.model.Issue;
import org.jboss.resteasy.client.jaxrs.BasicAuthentication;
import org.jboss.resteasy.client.jaxrs.ResteasyClient;
import org.jboss.resteasy.client.jaxrs.ResteasyClientBuilder;
import org.jboss.resteasy.client.jaxrs.ResteasyWebTarget;
import org.springframework.context.annotation.Scope;
import org.springframework.context.annotation.ScopedProxyMode;
import org.springframework.stereotype.Component;
import org.springframework.web.context.WebApplicationContext;

@Component
@Scope(value = WebApplicationContext.SCOPE_SESSION, proxyMode = ScopedProxyMode.TARGET_CLASS)
public class JiraService {

    JiraController mJiraController;

    public void init(JiraUserDto jiraUser) {
        if (jiraUser.getJiraname() == null || jiraUser.getToken() == null || jiraUser.getLocation() == null) {
            return;
        }

        ResteasyClient client = new ResteasyClientBuilder().build();
        ResteasyWebTarget target = client.target(jiraUser.getLocation());
        target.register(new BasicAuthentication(jiraUser.getJiraname(), jiraUser.getToken()));
        mJiraController = new JiraControllerImpl(target);
    }

    public Issue getIssue(String id) {
        return mJiraController != null ? mJiraController.findIssue(id) : null;
    }
}
