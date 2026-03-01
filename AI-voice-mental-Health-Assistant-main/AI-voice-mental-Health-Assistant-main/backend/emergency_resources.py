"""
Emergency Resource Configuration System
Configurable helpline and emergency contact management
"""

import json
import os
from typing import Dict, List, Optional
from dataclasses import dataclass, asdict
from enum import Enum


class ResourceType(Enum):
    """Types of emergency resources"""
    CRISIS_HELPLINE = "crisis_helpline"
    EMERGENCY_SERVICES = "emergency_services"
    TEXT_LINE = "text_line"
    CHAT_SERVICE = "chat_service"
    PROFESSIONAL_REFERRAL = "professional_referral"


@dataclass
class EmergencyContact:
    """Emergency contact information"""
    name: str
    number: str
    description: str
    country: str
    resource_type: ResourceType
    available_24_7: bool = True
    website: Optional[str] = None
    additional_info: Optional[str] = None


@dataclass
class CrisisMessageConfig:
    """Crisis message configuration"""
    primary_message: str
    secondary_message: Optional[str] = None
    include_contacts: bool = True
    include_disclaimer: bool = True
    custom_disclaimer: Optional[str] = None


class EmergencyResourceManager:
    """Manages emergency resources and crisis message configuration"""
    
    def __init__(self, config_file: Optional[str] = None):
        """
        Initialize emergency resource manager
        
        Args:
            config_file: Optional path to configuration file
        """
        self.config_file = config_file or "emergency_resources.json"
        self.contacts: List[EmergencyContact] = []
        self.crisis_message_config: CrisisMessageConfig = self._get_default_crisis_config()
        self.fallback_contacts: List[EmergencyContact] = self._get_default_fallback_contacts()
        
        # Load configuration if file exists
        self.load_configuration()
    
    def _get_default_crisis_config(self) -> CrisisMessageConfig:
        """Get default crisis message configuration"""
        return CrisisMessageConfig(
            primary_message="""I'm very concerned about what you've shared with me. Your safety is the most important thing right now.

Please reach out for immediate support:""",
            secondary_message="""You don't have to go through this alone. There are people who want to help you, and things can get better. Please reach out to one of these resources right away.""",
            include_contacts=True,
            include_disclaimer=True,
            custom_disclaimer="This screening tool is not a substitute for professional medical advice, diagnosis, or treatment."
        )
    
    def _get_default_fallback_contacts(self) -> List[EmergencyContact]:
        """Get default fallback emergency contacts"""
        return [
            EmergencyContact(
                name="Crisis Helpline",
                number="988",
                description="National Crisis Helpline (available 24/7)",
                country="US",
                resource_type=ResourceType.CRISIS_HELPLINE,
                available_24_7=True,
                website="https://988lifeline.org"
            ),
            EmergencyContact(
                name="Emergency Services",
                number="911",
                description="Emergency medical and police services",
                country="US",
                resource_type=ResourceType.EMERGENCY_SERVICES,
                available_24_7=True
            ),
            EmergencyContact(
                name="Crisis Text Line",
                number="741741",
                description="Text HOME to 741741 for crisis support",
                country="US",
                resource_type=ResourceType.TEXT_LINE,
                available_24_7=True,
                website="https://crisistextline.org",
                additional_info="Text HOME to start conversation"
            ),
            EmergencyContact(
                name="International Crisis Helpline",
                number="+1-800-273-8255",
                description="International crisis support",
                country="International",
                resource_type=ResourceType.CRISIS_HELPLINE,
                available_24_7=True
            )
        ]
    
    def load_configuration(self) -> bool:
        """
        Load configuration from file
        
        Returns:
            True if configuration loaded successfully, False otherwise
        """
        try:
            if os.path.exists(self.config_file):
                with open(self.config_file, 'r', encoding='utf-8') as f:
                    config_data = json.load(f)
                
                # Load contacts
                if 'contacts' in config_data:
                    self.contacts = []
                    for contact_data in config_data['contacts']:
                        contact = EmergencyContact(
                            name=contact_data['name'],
                            number=contact_data['number'],
                            description=contact_data['description'],
                            country=contact_data['country'],
                            resource_type=ResourceType(contact_data['resource_type']),
                            available_24_7=contact_data.get('available_24_7', True),
                            website=contact_data.get('website'),
                            additional_info=contact_data.get('additional_info')
                        )
                        self.contacts.append(contact)
                
                # Load crisis message configuration
                if 'crisis_message_config' in config_data:
                    msg_config = config_data['crisis_message_config']
                    self.crisis_message_config = CrisisMessageConfig(
                        primary_message=msg_config['primary_message'],
                        secondary_message=msg_config.get('secondary_message'),
                        include_contacts=msg_config.get('include_contacts', True),
                        include_disclaimer=msg_config.get('include_disclaimer', True),
                        custom_disclaimer=msg_config.get('custom_disclaimer')
                    )
                
                return True
        except Exception as e:
            print(f"Error loading configuration: {e}")
            return False
        
        return False
    
    def save_configuration(self) -> bool:
        """
        Save current configuration to file
        
        Returns:
            True if configuration saved successfully, False otherwise
        """
        try:
            config_data = {
                'contacts': [asdict(contact) for contact in self.contacts],
                'crisis_message_config': asdict(self.crisis_message_config)
            }
            
            # Convert enum to string for JSON serialization
            for contact in config_data['contacts']:
                contact['resource_type'] = contact['resource_type'].value
            
            with open(self.config_file, 'w', encoding='utf-8') as f:
                json.dump(config_data, f, indent=2, ensure_ascii=False)
            
            return True
        except Exception as e:
            print(f"Error saving configuration: {e}")
            return False
    
    def add_contact(self, contact: EmergencyContact) -> None:
        """
        Add emergency contact
        
        Args:
            contact: Emergency contact to add
        """
        self.contacts.append(contact)
    
    def remove_contact(self, name: str, country: str) -> bool:
        """
        Remove emergency contact by name and country
        
        Args:
            name: Contact name
            country: Contact country
            
        Returns:
            True if contact was removed, False if not found
        """
        for i, contact in enumerate(self.contacts):
            if contact.name == name and contact.country == country:
                del self.contacts[i]
                return True
        return False
    
    def get_contacts_by_country(self, country: str) -> List[EmergencyContact]:
        """
        Get emergency contacts for specific country
        
        Args:
            country: Country code or name
            
        Returns:
            List of emergency contacts for the country
        """
        return [contact for contact in self.contacts if contact.country.lower() == country.lower()]
    
    def get_contacts_by_type(self, resource_type: ResourceType) -> List[EmergencyContact]:
        """
        Get emergency contacts by resource type
        
        Args:
            resource_type: Type of resource
            
        Returns:
            List of emergency contacts of the specified type
        """
        return [contact for contact in self.contacts if contact.resource_type == resource_type]
    
    def get_all_contacts(self) -> List[EmergencyContact]:
        """
        Get all configured emergency contacts
        
        Returns:
            List of all emergency contacts
        """
        return self.contacts.copy()
    
    def get_fallback_contacts(self) -> List[EmergencyContact]:
        """
        Get fallback emergency contacts
        
        Returns:
            List of fallback emergency contacts
        """
        return self.fallback_contacts.copy()
    
    def update_crisis_message_config(self, config: CrisisMessageConfig) -> None:
        """
        Update crisis message configuration
        
        Args:
            config: New crisis message configuration
        """
        self.crisis_message_config = config
    
    def get_crisis_message_config(self) -> CrisisMessageConfig:
        """
        Get current crisis message configuration
        
        Returns:
            Current crisis message configuration
        """
        return self.crisis_message_config
    
    def generate_crisis_message(self, country: Optional[str] = None) -> str:
        """
        Generate formatted crisis message with appropriate contacts
        
        Args:
            country: Optional country for localized contacts
            
        Returns:
            Formatted crisis message string
        """
        message_parts = []
        
        # Add primary message
        message_parts.append(self.crisis_message_config.primary_message)
        
        # Add contacts if enabled
        if self.crisis_message_config.include_contacts:
            # Get relevant contacts
            relevant_contacts = []
            
            if country:
                relevant_contacts = self.get_contacts_by_country(country)
            
            # If no country-specific contacts or no country specified, use all contacts
            if not relevant_contacts:
                relevant_contacts = self.contacts if self.contacts else self.fallback_contacts
            
            # Format contacts
            if relevant_contacts:
                for contact in relevant_contacts[:4]:  # Limit to 4 contacts
                    contact_line = f"• {contact.name}: {contact.number}"
                    if contact.additional_info:
                        contact_line += f" ({contact.additional_info})"
                    elif contact.available_24_7:
                        contact_line += " (available 24/7)"
                    message_parts.append(contact_line)
        
        # Add secondary message
        if self.crisis_message_config.secondary_message:
            message_parts.append("")  # Empty line
            message_parts.append(self.crisis_message_config.secondary_message)
        
        # Add disclaimer if enabled
        if self.crisis_message_config.include_disclaimer:
            disclaimer = self.crisis_message_config.custom_disclaimer or \
                        "This screening tool is not a substitute for professional medical advice, diagnosis, or treatment."
            message_parts.append("")  # Empty line
            message_parts.append(disclaimer)
        
        return "\n".join(message_parts)
    
    def validate_configuration(self) -> List[str]:
        """
        Validate current configuration
        
        Returns:
            List of validation errors (empty if valid)
        """
        errors = []
        
        # Check if we have at least one contact
        if not self.contacts and not self.fallback_contacts:
            errors.append("No emergency contacts configured")
        
        # Validate contacts
        for contact in self.contacts:
            if not contact.name.strip():
                errors.append(f"Contact has empty name: {contact}")
            if not contact.number.strip():
                errors.append(f"Contact has empty number: {contact.name}")
            if not contact.description.strip():
                errors.append(f"Contact has empty description: {contact.name}")
        
        # Validate crisis message config
        if not self.crisis_message_config.primary_message.strip():
            errors.append("Primary crisis message is empty")
        
        return errors


# Global emergency resource manager instance
emergency_manager = EmergencyResourceManager()