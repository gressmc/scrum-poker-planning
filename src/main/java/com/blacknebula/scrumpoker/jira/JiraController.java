package com.blacknebula.scrumpoker.jira;

import com.blacknebula.scrumpoker.jira.model.Issue;

import javax.ws.rs.GET;
import javax.ws.rs.Path;
import javax.ws.rs.PathParam;
import javax.ws.rs.Produces;
import javax.ws.rs.core.MediaType;

public interface JiraController {

    @GET
    @Path("/rest/api/2/issue/{id}")
    @Produces({ MediaType.APPLICATION_JSON, MediaType.APPLICATION_XML })
    public Issue findIssue(@PathParam("id") String issueId);

}