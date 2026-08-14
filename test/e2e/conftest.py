"""E2E test conftest — browser fixtures + server startup."""

import os
import sys
import pytest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent / "app" / "src"))

BASE_URL = os.environ.get("BASE_URL", "http://127.0.0.1:3000")


@pytest.fixture(scope="session")
def browser_type():
    """Determine which browser driver to use for E2E tests."""
    try:
        import playwright.sync_api
        return playwright.sync_api
    except ImportError:
        pytest.skip("Playwright not installed — install with 'npx playwright install'")


@pytest.fixture(scope="session")
def browser(browser_type):
    """Launch browser for E2E testing."""
    with browser_type.sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        yield browser
        browser.close()


@pytest.fixture
def page(browser):
    """Create a new page context for each test."""
    context = browser.new_context(
        base_url=BASE_URL,
        viewport={"width": 1280, "height": 720},
    )
    page = context.new_page()
    yield page
    context.close()


@pytest.fixture
def e2e_api_client():
    """API client configured with test API key for E2E data setup."""
    import httpx
    
    api_key = os.environ.get("API_KEY", "test-key-0123456789abcdef-xxxxxxxxxxxxxxx")
    
    class Client:
        def __init__(self):
            self.client = httpx.Client(
                base_url=f"{BASE_URL}/api",
                headers={
                    "Content-Type": "application/json",
                    "X-API-Key": api_key,
                },
                timeout=10.0,
            )
        
        def setup_test_data(self, num_projects=3, num_tasks_per_project=5):
            """Create test projects and tasks for E2E flows."""
            # Clean existing
            # Create projects
            projects = []
            for i in range(num_projects):
                resp = self.client.post("/projects", json={
                    "name": f"E2E Project {i}",
                    "description": f"Test project for E2E scenario {i}",
                })
                if resp.status_code == 201:
                    projects.append(resp.json())
            
            # Create tasks
            tasks = []
            for proj in projects[:1]:  # Tasks per first project only
                statuses = ["in_work", "review", "done"]
                priorities = ["high", "medium", "low"]
                for s_idx, status in enumerate(statuses):
                    for p_idx, priority in enumerate(priorities):
                        resp = self.client.post("/tasks", json={
                            "projectId": proj["id"],
                            "title": f"E2E Task {s_idx * 3 + p_idx}",
                            "status": status,
                            "priority": priority,
                            "assignee": "E2E Tester",
                        })
                        if resp.status_code == 201:
                            tasks.append(resp.json())
            
            return {"projects": projects, "tasks": tasks}
        
        def cleanup(self, projects=None):
            """Clean up created test data."""
            if projects:
                for proj in reversed(projects):
                    try:
                        self.client.delete(f"/projects/{proj['id']}")
                    except Exception:
                        pass
        
        def close(self):
            self.client.close()
    
    return Client()
