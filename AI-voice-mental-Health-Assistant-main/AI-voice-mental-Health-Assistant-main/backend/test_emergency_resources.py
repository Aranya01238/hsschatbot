"""
Unit tests for emergency resource configuration system
Tests helpline configuration loading, crisis message customization, and fallback resource handling
**Validates: Requirements 10.1, 10.2, 10.4**
"""

import pytest
import json
import os
import tempfile
from emergency_resources import (
    EmergencyResourceManager, EmergencyContact, CrisisMessageConfig, 
    ResourceType
)


class TestEmergencyResourceConfiguration:
    """Unit tests for emergency resource configuration system"""
    
    def setup_method(self):
        """Set up test fixtures"""
        # Create temporary config file for testing
        self.temp_file = tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False)
        self.temp_file.close()
        self.config_file = self.temp_file.name
        
        self.manager = EmergencyResourceManager(self.config_file)
    
    def teardown_method(self):
        """Clean up test fixtures"""
        if os.path.exists(self.config_file):
            os.unlink(self.config_file)
    
    def test_helpline_configuration_loading(self):
        """
        Test helpline configuration loading
        **Validates: Requirements 10.1**
        """
        # Create test configuration
        test_config = {
            "contacts": [
                {
                    "name": "Test Crisis Helpline",
                    "number": "123-456-7890",
                    "description": "Test crisis support",
                    "country": "US",
                    "resource_type": "crisis_helpline",
                    "available_24_7": True,
                    "website": "https://test.org"
                },
                {
                    "name": "Test Emergency Services",
                    "number": "911",
                    "description": "Test emergency services",
                    "country": "US",
                    "resource_type": "emergency_services",
                    "available_24_7": True
                }
            ],
            "crisis_message_config": {
                "primary_message": "Test crisis message",
                "include_contacts": True,
                "include_disclaimer": True
            }
        }
        
        # Write test configuration to file
        with open(self.config_file, 'w') as f:
            json.dump(test_config, f)
        
        # Load configuration
        success = self.manager.load_configuration()
        assert success is True
        
        # Verify contacts were loaded
        contacts = self.manager.get_all_contacts()
        assert len(contacts) == 2
        
        # Verify first contact
        crisis_contact = contacts[0]
        assert crisis_contact.name == "Test Crisis Helpline"
        assert crisis_contact.number == "123-456-7890"
        assert crisis_contact.resource_type == ResourceType.CRISIS_HELPLINE
        assert crisis_contact.available_24_7 is True
        assert crisis_contact.website == "https://test.org"
        
        # Verify second contact
        emergency_contact = contacts[1]
        assert emergency_contact.name == "Test Emergency Services"
        assert emergency_contact.number == "911"
        assert emergency_contact.resource_type == ResourceType.EMERGENCY_SERVICES
    
    def test_crisis_message_customization(self):
        """
        Test crisis message customization
        **Validates: Requirements 10.2**
        """
        # Test default crisis message config
        default_config = self.manager.get_crisis_message_config()
        assert default_config.primary_message is not None
        assert len(default_config.primary_message) > 0
        assert default_config.include_contacts is True
        assert default_config.include_disclaimer is True
        
        # Test custom crisis message config
        custom_config = CrisisMessageConfig(
            primary_message="Custom crisis message",
            secondary_message="Custom secondary message",
            include_contacts=False,
            include_disclaimer=False,
            custom_disclaimer="Custom disclaimer"
        )
        
        self.manager.update_crisis_message_config(custom_config)
        updated_config = self.manager.get_crisis_message_config()
        
        assert updated_config.primary_message == "Custom crisis message"
        assert updated_config.secondary_message == "Custom secondary message"
        assert updated_config.include_contacts is False
        assert updated_config.include_disclaimer is False
        assert updated_config.custom_disclaimer == "Custom disclaimer"
        
        # Test crisis message generation with custom config
        message = self.manager.generate_crisis_message()
        assert "Custom crisis message" in message
        assert "Custom secondary message" in message
        # Should not include disclaimer since include_disclaimer is False
        assert "Custom disclaimer" not in message
        # Should not include contacts since include_contacts is False
        assert "•" not in message  # Bullet points indicate contacts
    
    def test_fallback_resource_handling(self):
        """
        Test fallback resource handling
        **Validates: Requirements 10.4**
        """
        # Test that fallback contacts are available
        fallback_contacts = self.manager.get_fallback_contacts()
        assert len(fallback_contacts) > 0
        
        # Verify fallback contacts have required fields
        for contact in fallback_contacts:
            assert contact.name is not None and len(contact.name) > 0
            assert contact.number is not None and len(contact.number) > 0
            assert contact.description is not None and len(contact.description) > 0
            assert contact.country is not None and len(contact.country) > 0
            assert isinstance(contact.resource_type, ResourceType)
        
        # Test crisis message generation with no configured contacts (should use fallback)
        self.manager.contacts = []  # Clear configured contacts
        message = self.manager.generate_crisis_message()
        
        # Should include fallback contacts
        assert "988" in message or "911" in message  # Should have at least one fallback number
        assert "•" in message  # Should have bullet points for contacts
        
        # Test that fallback contacts include crisis helpline
        crisis_helplines = [c for c in fallback_contacts if c.resource_type == ResourceType.CRISIS_HELPLINE]
        assert len(crisis_helplines) > 0
        
        # Test that fallback contacts include emergency services
        emergency_services = [c for c in fallback_contacts if c.resource_type == ResourceType.EMERGENCY_SERVICES]
        assert len(emergency_services) > 0
    
    def test_contact_management(self):
        """Test adding and removing emergency contacts"""
        # Test adding contact
        new_contact = EmergencyContact(
            name="Test Contact",
            number="555-0123",
            description="Test description",
            country="CA",
            resource_type=ResourceType.CRISIS_HELPLINE,
            available_24_7=False,
            website="https://example.com"
        )
        
        initial_count = len(self.manager.get_all_contacts())
        self.manager.add_contact(new_contact)
        
        assert len(self.manager.get_all_contacts()) == initial_count + 1
        
        # Verify contact was added correctly
        added_contact = self.manager.get_all_contacts()[-1]
        assert added_contact.name == "Test Contact"
        assert added_contact.number == "555-0123"
        assert added_contact.country == "CA"
        assert added_contact.available_24_7 is False
        
        # Test removing contact
        success = self.manager.remove_contact("Test Contact", "CA")
        assert success is True
        assert len(self.manager.get_all_contacts()) == initial_count
        
        # Test removing non-existent contact
        success = self.manager.remove_contact("Non-existent", "XX")
        assert success is False
    
    def test_country_filtering(self):
        """Test filtering contacts by country"""
        # Add test contacts for different countries
        us_contact = EmergencyContact(
            name="US Contact",
            number="911",
            description="US emergency",
            country="US",
            resource_type=ResourceType.EMERGENCY_SERVICES
        )
        
        ca_contact = EmergencyContact(
            name="CA Contact",
            number="911",
            description="CA emergency",
            country="CA",
            resource_type=ResourceType.EMERGENCY_SERVICES
        )
        
        self.manager.add_contact(us_contact)
        self.manager.add_contact(ca_contact)
        
        # Test filtering by country
        us_contacts = self.manager.get_contacts_by_country("US")
        ca_contacts = self.manager.get_contacts_by_country("CA")
        
        assert len(us_contacts) >= 1
        assert len(ca_contacts) >= 1
        
        # Verify correct contacts returned
        us_names = [c.name for c in us_contacts]
        ca_names = [c.name for c in ca_contacts]
        
        assert "US Contact" in us_names
        assert "CA Contact" in ca_names
        assert "CA Contact" not in us_names
        assert "US Contact" not in ca_names
    
    def test_resource_type_filtering(self):
        """Test filtering contacts by resource type"""
        # Add contacts of different types
        helpline_contact = EmergencyContact(
            name="Helpline",
            number="988",
            description="Crisis helpline",
            country="US",
            resource_type=ResourceType.CRISIS_HELPLINE
        )
        
        text_contact = EmergencyContact(
            name="Text Line",
            number="741741",
            description="Crisis text line",
            country="US",
            resource_type=ResourceType.TEXT_LINE
        )
        
        self.manager.add_contact(helpline_contact)
        self.manager.add_contact(text_contact)
        
        # Test filtering by resource type
        helplines = self.manager.get_contacts_by_type(ResourceType.CRISIS_HELPLINE)
        text_lines = self.manager.get_contacts_by_type(ResourceType.TEXT_LINE)
        
        assert len(helplines) >= 1
        assert len(text_lines) >= 1
        
        # Verify correct types returned
        for contact in helplines:
            assert contact.resource_type == ResourceType.CRISIS_HELPLINE
        
        for contact in text_lines:
            assert contact.resource_type == ResourceType.TEXT_LINE
    
    def test_configuration_persistence(self):
        """Test saving and loading configuration"""
        # Add test contact and custom message
        test_contact = EmergencyContact(
            name="Persistent Contact",
            number="555-SAVE",
            description="Test persistence",
            country="TEST",
            resource_type=ResourceType.CRISIS_HELPLINE
        )
        
        custom_config = CrisisMessageConfig(
            primary_message="Persistent message",
            include_contacts=False
        )
        
        self.manager.add_contact(test_contact)
        self.manager.update_crisis_message_config(custom_config)
        
        # Save configuration
        success = self.manager.save_configuration()
        assert success is True
        assert os.path.exists(self.config_file)
        
        # Create new manager and load configuration
        new_manager = EmergencyResourceManager(self.config_file)
        success = new_manager.load_configuration()
        assert success is True
        
        # Verify contact was persisted
        contacts = new_manager.get_all_contacts()
        contact_names = [c.name for c in contacts]
        assert "Persistent Contact" in contact_names
        
        # Verify message config was persisted
        loaded_config = new_manager.get_crisis_message_config()
        assert loaded_config.primary_message == "Persistent message"
        assert loaded_config.include_contacts is False
    
    def test_configuration_validation(self):
        """Test configuration validation"""
        # Test valid configuration
        errors = self.manager.validate_configuration()
        assert isinstance(errors, list)
        # Should have no errors with default configuration
        assert len(errors) == 0
        
        # Test invalid configuration - empty primary message
        invalid_config = CrisisMessageConfig(
            primary_message="",  # Empty message
            include_contacts=True
        )
        self.manager.update_crisis_message_config(invalid_config)
        
        errors = self.manager.validate_configuration()
        assert len(errors) > 0
        assert any("Primary crisis message is empty" in error for error in errors)
        
        # Test invalid contact - empty name
        invalid_contact = EmergencyContact(
            name="",  # Empty name
            number="123",
            description="Test",
            country="US",
            resource_type=ResourceType.CRISIS_HELPLINE
        )
        self.manager.add_contact(invalid_contact)
        
        errors = self.manager.validate_configuration()
        assert len(errors) > 0
        assert any("empty name" in error for error in errors)
    
    def test_crisis_message_generation_with_contacts(self):
        """Test crisis message generation includes appropriate contacts"""
        # Add test contacts
        us_contact = EmergencyContact(
            name="US Helpline",
            number="988",
            description="US crisis support",
            country="US",
            resource_type=ResourceType.CRISIS_HELPLINE,
            available_24_7=True
        )
        
        ca_contact = EmergencyContact(
            name="CA Helpline",
            number="1-833-456-4566",
            description="CA crisis support",
            country="CA",
            resource_type=ResourceType.CRISIS_HELPLINE,
            available_24_7=True
        )
        
        self.manager.add_contact(us_contact)
        self.manager.add_contact(ca_contact)
        
        # Test US-specific message
        us_message = self.manager.generate_crisis_message("US")
        assert "US Helpline" in us_message
        assert "988" in us_message
        assert "CA Helpline" not in us_message
        
        # Test CA-specific message
        ca_message = self.manager.generate_crisis_message("CA")
        assert "CA Helpline" in ca_message
        assert "1-833-456-4566" in ca_message
        assert "US Helpline" not in ca_message
        
        # Test general message (no country specified)
        general_message = self.manager.generate_crisis_message()
        # Should include all contacts or fallback to default
        assert len(general_message) > 0
    
    def test_empty_configuration_file_handling(self):
        """Test handling of empty or non-existent configuration files"""
        # Test non-existent file
        non_existent_manager = EmergencyResourceManager("non_existent_file.json")
        success = non_existent_manager.load_configuration()
        assert success is False
        
        # Should still have fallback contacts
        fallback_contacts = non_existent_manager.get_fallback_contacts()
        assert len(fallback_contacts) > 0
        
        # Test empty file
        with open(self.config_file, 'w') as f:
            f.write("")
        
        empty_manager = EmergencyResourceManager(self.config_file)
        success = empty_manager.load_configuration()
        assert success is False
        
        # Should still work with fallback contacts
        message = empty_manager.generate_crisis_message()
        assert len(message) > 0