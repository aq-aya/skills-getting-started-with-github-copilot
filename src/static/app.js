document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");

  const DELETE_ICON = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none"
      stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M3 6h18" />
      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  `;

  let messageTimeout;

  function showMessage(text, type) {
    messageDiv.textContent = text;
    messageDiv.className = type;

    // Hide message after 5 seconds, restarting the countdown if one is already running
    clearTimeout(messageTimeout);
    messageTimeout = setTimeout(() => {
      messageDiv.classList.add("hidden");
    }, 5000);
  }

  async function unregisterParticipant(activityName, email, button) {
    button.disabled = true;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(activityName)}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }

      // Refresh even on a rejected request, since that means the list shown is out of date
      fetchActivities();
    } catch (error) {
      showMessage("Failed to unregister. Please try again.", "error");
      button.disabled = false;
      console.error("Error unregistering:", error);
    }
  }

  // Built with DOM nodes (not innerHTML) because participant emails are user-submitted
  function createParticipantsSection(activityName, participants) {
    const section = document.createElement("div");
    section.className = "participants-section";

    const heading = document.createElement("h5");
    heading.className = "participants-heading";
    heading.textContent = "Participants";

    const count = document.createElement("span");
    count.className = "participants-count";
    count.textContent = participants.length;
    heading.appendChild(count);

    section.appendChild(heading);

    if (participants.length === 0) {
      const empty = document.createElement("p");
      empty.className = "participants-empty";
      empty.textContent = "No one has signed up yet. Be the first!";
      section.appendChild(empty);
      return section;
    }

    const list = document.createElement("ul");
    list.className = "participants-list";

    participants.forEach((participant) => {
      const item = document.createElement("li");

      const email = document.createElement("span");
      email.className = "participant-email";
      email.textContent = participant;

      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className = "participant-remove";
      removeButton.title = `Unregister ${participant}`;
      removeButton.setAttribute("aria-label", `Unregister ${participant} from ${activityName}`);
      removeButton.innerHTML = DELETE_ICON;
      removeButton.addEventListener("click", () => {
        unregisterParticipant(activityName, participant, removeButton);
      });

      item.appendChild(email);
      item.appendChild(removeButton);
      list.appendChild(item);
    });

    section.appendChild(list);
    return section;
  }

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      // Clear loading message
      activitiesList.innerHTML = "";

      // Reset the dropdown so a refresh doesn't duplicate options
      const selectedActivity = activitySelect.value;
      activitySelect.innerHTML = '<option value="">-- Select an activity --</option>';

      // Populate activities list
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft = details.max_participants - details.participants.length;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
        `;

        activityCard.appendChild(createParticipantsSection(name, details.participants));

        activitiesList.appendChild(activityCard);

        // Add option to select dropdown
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

      activitySelect.value = selectedActivity;
    } catch (error) {
      activitiesList.innerHTML = "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(activity)}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");
        signupForm.reset();
        fetchActivities();
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      messageDiv.textContent = "Failed to sign up. Please try again.";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      console.error("Error signing up:", error);
    }
  });

  // Initialize app
  fetchActivities();
});
