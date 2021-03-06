import * as core from '@actions/core';
import * as github from '@actions/github';

interface Options {
  issueBaseUrl: string;
}

const prBodyIssuesReplaceRegex = /\[\/\/]:\s?#\s?\(autolink_jira_issues_start\)[\s\S]+\[\/\/\]:\s?#\s?\(autolink_jira_issues_end\)/gm;

const extractIssuesKeysFromBranch = (prBranchName: string, options: Options) => {
  const [_prefix, _description, ...jiraIssues] = prBranchName.split('/');
  return jiraIssues;
};

const createIssueLink = (issueKey: string, issueBaseUrl: string) => {
  return `[${issueKey}](${issueBaseUrl}/${issueKey})`;
};

function autolinkIssues(prBranchName: string, prBody: string | undefined, options: Options) {
  if (!prBody) return;

  const issuesKeys = extractIssuesKeysFromBranch(prBranchName, options);
  const issuesLinks = issuesKeys.map((issueKey) => createIssueLink(issueKey, options.issueBaseUrl));
  const issuesLinksFormatted = issuesLinks.join('\n');

  return prBody.replace(prBodyIssuesReplaceRegex, issuesKeys.length > 0 ? issuesLinksFormatted: 'No JIRA issues');
}

async function run() {
  try {
    if (!github.context.payload.pull_request) {
      throw {
        message: 'This action can only be executed from PR or Issue',
      };
    }

    const githubApiToken: string = core.getInput('github-token', { required: true});
    const issueBaseUrl = core.getInput('issue-base-url', { required: true });
    const pullRquestBranchName = github.context.payload.pull_request.head.ref;
    const pullRequestBody = github.context.payload.pull_request?.body;

    const newBody = autolinkIssues(pullRquestBranchName, pullRequestBody, {
      issueBaseUrl,
    });

    const updateRequest = {
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      pull_number: github.context.payload.pull_request.number,
      body: newBody,
    };

    console.log('Performing PR update request with parameters: ', updateRequest);

    const octokit = github.getOctokit(githubApiToken)
    let response;

    try {
      response = await octokit.pulls.update(updateRequest);
    } catch (e) {
      console.log('Failed to make a github API call for PR update');
      core.setFailed(e);
      return;
    }

    if (response.status !== 200) {
      core.error('Updating pull request has failed');
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
