"use strict";
var homeController = angular.module('homeController', []);

var Types = {
    story: "story",
    user: "user",
    vote: "vote",
    card: "card"
};

var Events = {
    vote_added: "VOTE_ADDED",
    vote_removed: "VOTE_REMOVED",
    story_added: "STORY_ADDED",
    story_removed: "STORY_REMOVED",
    story_ended: "STORY_ENDED",
    user_connected: "USER_CONNECTED",
    user_disconnected: "USER_DISCONNECTED",
    theme_changed: "THEME_CHANGED"
};

/*@ngInject*/
homeController.controller('homeCtrl', function ($http, $log, $scope, $localStorage, $location, $timeout,
                                                webSocketFactory, storyFactory, voteFactory, userFactory, sessionFactory, session, users, stories) {

    $scope.logout = function () {
        userFactory.disconnect(function (response) {
            if (response.status === 'OK') {
                webSocketFactory.disconnect();
                $location.path('/static/login');
            }
        });
    };

    $scope.getIndex = function (type, item) {
        var i, len;
        if (type === Types.story) {
            for (i = 0, len = $scope.stories.length; i < len; i++) {
                if ($scope.stories[i].storyId === item.storyId) {
                    return i;
                }
            }
            return -1;
        }

        if (type === Types.vote) {
            for (i = 0, len = $scope.votes.length; i < len; i++) {
                if ($scope.votes[i].voteId === item.voteId) {
                    return i;
                }
            }
            return -1;
        }

        if (type === Types.user) {
            for (i = 0, len = $scope.users.length; i < len; i++) {
                if ($scope.users[i].username === item.username) {
                    return i;
                }
            }
            return -1;
        }

        if (type === Types.card) {
            for (i = 0, len = $scope.cards.length; i < len; i++) {
                if (!$scope.cards[i].skip && $scope.cards[i].id === item.id) {
                    return i;
                }
            }
            return -1;
        }
    };

    $scope.setCurrentStory = function (story) {
        $scope.currentStory = story;
        //reset votes
        animateCard($scope.selectedCard);
        //get votes from backend
        getVotes();
    };

    $scope.hideMassage = function () {
        $scope.messageVisible = false;
    };

    $scope.showMassage = function (message) {
        $scope.message = message;
        $scope.messageVisible = true;
    };

    $scope.removeStory = function (story) {
        $scope.stories.splice($scope.getIndex(Types.story, story), 1);
        storyFactory.remove(story.storyId, function (data) {
            if (data.status === 'KO') {
                $scope.stories.push(story);
            }
        });
    };

    $scope.addStory = function () {
        if (!$scope.newStory.storyName) {
            return;
        }
        if (session.storyNamePrefix) {
            $scope.newStory.storyName = session.storyNamePrefix + $scope.newStory.storyName;
        }
        $scope.newStory.order = $scope.stories.length + 1;
        storyFactory.create($scope.newStory, function () {
            $scope.newStory = {};
        });
    };

    $scope.openDescModal = function (story) {
        if (story.description) {
            story.description=$scope.toM(story.description);
            var converter = new showdown.Converter();
            $scope.description = converter.makeHtml(story.description)
            $scope.storyName = story.storyName;
            $scope.show_modal = true;
        }
    };

    $scope.closeModal = function () {
        $scope.description='';
        $scope.storyName='';
        $scope.show_modal = false;
    };

    $scope.toM = function (input) {

        input = input.replace(/^bq\.(.*)$/gm, function (match, content) {
            return '> ' + content + "\n";
        });

        input = input.replace(/([*_])(.*)\1/g, function (match,wrapper,content) {
            var to = (wrapper === '*') ? '**' : '*';
            return to + content + to;
        });

        // multi-level numbered list
        input = input.replace(/^((?:#|-|\+|\*)+) (.*)$/gm, function (match, level, content) {
            var len = 2;
            var prefix = '1.';
            if (level.length > 1) {
                len = parseInt((level.length - 1) * 4) + 2;
            }

            // take the last character of the level to determine the replacement
            var prefix = level[level.length - 1];
            if (prefix == '#') prefix = '1.';

            return Array(len).join(" ") + prefix + ' ' + content;
        });

        // headers, must be after numbered lists
        input = input.replace(/^h([0-6])\.(.*)$/gm, function (match,level,content) {
            return Array(parseInt(level) + 1).join('#') + content;
        });

        input = input.replace(/\{\{([^}]+)\}\}/g, '`$1`');
        input = input.replace(/\?\?((?:.[^?]|[^?].)+)\?\?/g, '<cite>$1</cite>');
        input = input.replace(/\+([^+]*)\+/g, '<ins>$1</ins>');
        input = input.replace(/\^([^^]*)\^/g, '<sup>$1</sup>');
        input = input.replace(/~([^~]*)~/g, '<sub>$1</sub>');
        input = input.replace(/-([^-]*)-/g, '-$1-');

        input = input.replace(/\{code(:([a-z]+))?\}([^]*?)\{code\}/gm, '```$2$3```');
        input = input.replace(/\{quote\}([^]*)\{quote\}/gm, function(match, content) {
            var lines = content.split(/\r?\n/gm);

            for (var i = 0; i < lines.length; i++) {
                lines[i] = '> ' + lines[i];
            }

            return lines.join("\n");
        });

        input = input.replace(/!([^\n\s]+)!/, '![]($1)');
        input = input.replace(/\[([^|]+)\|(.+?)\]/g, '[$1]($2)');
        input = input.replace(/\[(.+?)\]([^\(]+)/g, '<$1>$2');

        input = input.replace(/{noformat}/g, '```');
        input = input.replace(/{color:([^}]+)}([^]*?){color}/gm, '<span style="color:$1">$2</span>');

        // Convert header rows of tables by splitting input on lines
        var lines = input.split(/\r?\n/gm);
        var lines_to_remove = []
        for (var i = 0; i < lines.length; i++) {
            var line_content = lines[i];

            var seperators = line_content.match(/\|\|/g);
            if (seperators != null) {
                lines[i] = lines[i].replace(/\|\|/g, "|");
                console.log(seperators)

                // Add a new line to mark the header in Markdown,
                // we require that at least 3 -'s are between each |
                var header_line = "";
                for (var j = 0; j < seperators.length-1; j++) {
                    header_line += "|---";
                }

                header_line += "|";

                lines.splice(i+1, 0, header_line);

            }
        }

        // Join the split lines back
        input = ""
        for (var i = 0; i < lines.length; i++) {
            input += lines[i] + "\n"
        }



        return input;
    };

    $scope.createVote = function (card) {
        $scope.loading = true;
        // hide error message
        $scope.hideMassage();

        var data = {
            storyId: $scope.currentStory.storyId,
            value: card.id
        };

        if ($scope.currentVote) {
            data.voteId = $scope.currentVote.voteId;
        }

        var index = $scope.getIndex(Types.vote, data);
        if (index >= 0) {
            $scope.votes[index] = data;
        }

        $scope.currentVote = data;
        animateCard(card);
        highlightVotes();

        voteFactory.create(data, function (response) {
            $scope.loading = false;
            var index = $scope.getIndex(Types.vote, response);
            if (index >= 0) {
                $scope.votes[index] = response;
            }
            $scope.currentVote = response;
        }, function (error) {
            $scope.loading = false;
            $scope.currentVote = {};
            animateCard(card);
            highlightVotes();

            $scope.showMassage(error.exception);
        });
    };

    $scope.removeVote = function (card) {
        $scope.loading = true;
        // hide error message
        $scope.hideMassage();

        voteFactory.remove($scope.currentVote.voteId, function (response) {
            $scope.loading = false;
            if (response.status === 'OK') {
                $scope.votes.splice($scope.getIndex(Types.vote, $scope.currentVote), 1);
                $scope.currentVote = {};
                animateCard(card);
                highlightVotes();
            }
        }, function (error) {
            $scope.loading = false;
            $scope.showMassage(error.exception);
        });
    };


    $scope.selectCard = function (card) {
        if (!$scope.currentStory) {
            $scope.showMassage("You should select a story");
            return;
        }

        if ($scope.currentStory.ended) {
            $scope.showMassage("Selected story has already ended");
            return;
        }

        if ($scope.loading) {
            return;
        }

        if (!card.selected) {
            $scope.createVote(card);
        } else {
            $scope.removeVote(card);
        }
    };

    $scope.endVote = function () {
        storyFactory.endStory($scope.currentStory.storyId, function (response) {
            if (response.status === 'OK') {
                $scope.getStats();
            } else {
                $scope.currentStory.ended = false;

            }
        });
    };

    $scope.getCard = function (id) {
        var selectCard;
        for (var i = 0, len = $scope.cards.length; i < len; i++) {
            if ($scope.cards[i].id === id) {
                selectCard = $scope.cards[i];
                break;
            }
        }

        return selectCard;
    };

    $scope.getColor = function (vote) {
        if (!vote) {
            return {};
        }
        var field = $scope.getCard(vote).color,
            color = {};
        color[field] = $scope.currentStory.ended;
        return color;
    };

    $scope.getStats = function () {
        $scope.min = '-';
        $scope.max = '-';
        $scope.mean = '-';
        $scope.groups = {};
        if (!$scope.currentStory.ended) {
            return;
        }
        var min = angular.undefined,
            max = angular.undefined,
            sum = 0,
            totalValidVotes = 0,
            groups = {},
            index;
        angular.forEach($scope.votes, function (vote) {
            index = $scope.getIndex(Types.card, {id: vote.value});
            if (index >= 0) {
                var card = $scope.cards[index];
                sum += card.value; // add value in hours
                totalValidVotes++;
                if (!angular.isDefined(max) || index > max) {
                    max = index;
                }
                if (!angular.isDefined(min) || index < min) {
                    min = index;
                }

                if (groups.hasOwnProperty(card.value)) {
                    groups[card.value.toString()].count++;
                } else {
                    groups[card.value.toString()] = {
                        value: card.value,
                        count: 1
                    };
                }
            }
        });

        $scope.groups = Object.values(groups);

        if (angular.isDefined(min)) {
            $scope.min = $scope.toHumanReadableValue($scope.cards[min]);
        }


        if (angular.isDefined(max)) {
            $scope.max = $scope.toHumanReadableValue($scope.cards[max]);
        }

        if (totalValidVotes > 0) {
            var mean = '-';
            if (!isNaN(sum)) {
                mean = sum / totalValidVotes;
            }
            $scope.mean = $scope.toHumanReadableValue({value: mean});
        }
    };

    $scope.toHumanReadableValue = function (card) {
        if (!card) {
            return;
        }
        return ($scope.cardSet === 'time' && !card.skip) ? toHumanDuration(card.value) : card.value;
    };

    $scope.changeTheme = function (theme) {
        if (angular.isUndefined(theme)) {
            return;
        }
        var data = {
            cardTheme: theme
        };
        sessionFactory.setTheme(data, function (response) {
            setTheme(response.cardTheme)
        });
    };

    $scope.banUser = function (user) {
        if (!user || $scope.currentUser.username === user.username) {
            return;
        }
        userFactory.banUser(user.username, function () {
            var index = $scope.getIndex(Types.user, {username: user.username});
            if (index >= 0) {
                $scope.users.splice(index, 1);
            }
        });
    };

    $scope.consumeEvent = function (item) {
        $log.info(item);
        var index;
        if (item.type === Events.story_added) {
            index = $scope.getIndex(Types.story, item.data);
            if (index < 0) {
                $scope.stories.push(item.data);
            }

        } else if (item.type === Events.story_removed) {
            index = $scope.getIndex(Types.story, {storyId: item.data});
            if (index >= 0) {
                $scope.stories.splice(index, 1);
            }

        } else if (item.type === Events.story_ended) {
            index = $scope.getIndex(Types.story, {storyId: item.data});
            if (index >= 0) {
                $scope.stories[index].ended = true;
                $scope.getStats();
            }

        } else if (item.type === Events.vote_added) {
            if (!$scope.currentStory || $scope.currentStory.storyId !== item.data.storyId) {
                return;
            }
            index = $scope.getIndex(Types.vote, item.data);
            if (index < 0) {
                $scope.votes.push(item.data);
            } else {
                $scope.votes[index] = item.data;
            }
            // add vote to user
            var userIndex = $scope.getIndex(Types.user, {username: item.data.username});
            $scope.users[userIndex].vote = item.data.value;
            $scope.users[userIndex].hasVoted = true;

        } else if (item.type === Events.vote_removed) {
            index = $scope.getIndex(Types.vote, {voteId: item.data});
            if (index >= 0) {
                var username = $scope.votes[index].username;
                if (username !== $scope.currentUser.username) {
                    var userIndex = $scope.getIndex(Types.user, {username: username});
                    $scope.users[userIndex].vote = {};
                    $scope.users[userIndex].hasVoted = false;
                    $scope.votes.splice(index, 1);
                }
            }

        } else if (item.type === Events.user_connected) {
            index = $scope.getIndex(Types.user, item.data);
            if (index < 0) {
                $scope.users.push(item.data);
            }

        } else if (item.type === Events.user_disconnected) {
            // if user has been disconnected by admin
            if (item.data === $scope.currentUser.username) {
                $scope.logout();
            } else {
                index = $scope.getIndex(Types.user, {username: item.data});
                if (index >= 0) {
                    $scope.users.splice(index, 1);
                }
            }
        } else if (item.type === Events.theme_changed) {
            // set new theme
            setTheme(item.data.cardTheme);

        }
        $scope.$apply();
    };

    function setTheme(theme) {
        if (angular.isUndefined(theme)) {
            return;
        }
        $scope.theme = theme;
        $scope.extension = ($scope.theme === 'redbooth') ? 'svg' : 'png';
    }

    function toHumanDuration(durationInHours) {
        durationInHours = Math.floor(durationInHours);
        var weeks = Math.floor(durationInHours / 40);
        var days = Math.floor((durationInHours % 40) / 8);
        var hours = durationInHours - days * 8 - weeks * 40;
        var duration = '';
        if (weeks > 0) {
            duration += weeks + ' w ';
        }
        if (days > 0) {
            duration += days + ' d ';
        }
        if (hours > 0) {
            duration += hours + ' h';
        }
        return duration;
    }

    function getVotes() {
        if (!$scope.currentStory)
            return;

        //get saved votes
        voteFactory.get($scope.currentStory.storyId, function (data) {
            $scope.votes = data;
            $scope.currentVote = angular.undefined;

            for (var i = 0, len = $scope.votes.length; i < len; i++) {
                if ($scope.votes[i].username === $scope.currentUser.username) {
                    $scope.currentVote = $scope.votes[i];
                    break;
                }
            }

            // show current users selected card
            highlightCard();
            // show users votes
            highlightVotes();
            // get stats
            $scope.getStats();
        })
    }

    function init() {
        if (!$localStorage.currentUser) {
            $location.path('/static/login');
        }
        //initialize clipboard (copy to keyboard feature)
        new Clipboard('.clipboard');

        $scope.showEndedStories = false;
        $scope.description='';
        $scope.storyName='';

        $scope.info = {
            selected: 'stories'
        };

        $scope.votes = [];

        $scope.currentStory = {};
        $scope.newStory = {};

        $scope.currentVote = {};

        $scope.currentUser = $localStorage.currentUser;

        //subscribe
        webSocketFactory.subscribe($scope.currentUser.sessionId, function (data) {
            $scope.consumeEvent(data);
        });

        //get users
        $scope.users = users;

        setTheme(session.cardTheme);

        //get session info
        $scope.sprintName = session.sprintName;
        $scope.cardSet = session.cardSet;
        $scope.cards = cards.fibonacci;

        //get stories
        $scope.stories = stories;
        // set current story
        $scope.setCurrentStory($scope.stories[0]);
    }

    function animateCard(card) {
        if (!card)
            return;
        if (!card.selected) {
            if ($scope.selectedCard) {
                $scope.selectedCard.selected = false;
                $scope.selectedCard.animate = 'move-down';
            }
            $scope.selectedCard = card;
            card.selected = true;
            card.animate = 'move-up';
        } else {
            card.selected = false;
            card.animate = 'move-down';
            $scope.selectedCard = angular.undefined;
        }
    }

    function highlightVotes() {
        var vote;
        angular.forEach($scope.users, function (user) {
            user.hasVoted = false;
            user.vote = angular.undefined;
            for (var i = 0, len = $scope.votes.length; i < len; i++) {
                vote = $scope.votes[i];
                if (vote.username === user.username) {
                    user.hasVoted = true;
                    user.vote = vote.value;
                    break;
                }
            }

        });
    }

    function highlightCard() {
        for (var i = 0, len = $scope.votes.length; i < len; i++) {
            if ($scope.votes[i].username === $scope.currentUser.username) {
                var card = $scope.getCard($scope.votes[i].value);
                animateCard(card);
                break;
            }
        }
    }

    $scope.$on('$destroy', function () {

    });

    init();
});

homeController.resolve = {
    /*@ngInject*/
    session: function (sessionFactory, $localStorage, $q) {
        var delay = $q.defer();
        sessionFactory.get(function (data) {
            delay.resolve(data);
        });
        return delay.promise;
    },
    /*@ngInject*/
    users: function (userFactory, $localStorage, $q) {
        var delay = $q.defer();
        userFactory.get(function (data) {
            delay.resolve(data);
        });
        return delay.promise;
    },
    /*@ngInject*/
    stories: function (storyFactory, $localStorage, $q) {
        var delay = $q.defer();
        storyFactory.get(function (data) {
            delay.resolve(data);
        });
        return delay.promise;
    }
};