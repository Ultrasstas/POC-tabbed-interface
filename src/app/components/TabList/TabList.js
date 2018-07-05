import React from 'react';
import { Tab, Menu, Label } from 'semantic-ui-react';
import { connect, actions } from '../../store';
import TabListStub from './TabListStub/TabListStub';
import { UserTab, OrganizationTab, TicketTab } from './styled-tabs';

import './TabList.scss';

class TabList extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      hasActiveTabs: false,
      panes: [],
    };
  }

  componentDidUpdate(prevProps) {
    if (this.props.activeTabs !== prevProps.activeTabs) {
      this.handleActiveTabs(this.props.activeTabs);
    }
  }

  /**
   * Returns tab content component depends on item type.
   * @param {string} type
   * @param {Object} data
   * @returns {*}
   */
  getTabContentByType(type, data) {
    switch (type) {
      case 'people':
        return (
          <Tab.Pane>
            <UserTab user={data} onDelete={this.props.onDeleteItem} />
          </Tab.Pane>
        );

      case 'organizations':
        return (
          <Tab.Pane>
            <OrganizationTab organization={data} onDelete={this.props.onDeleteItem} />
          </Tab.Pane>
        );

      case 'tickets':
        return (
          <Tab.Pane>
            <TicketTab ticket={data} onDelete={this.props.onDeleteItem} />
          </Tab.Pane>
        );

      default:
        return (<div>default</div>);
    }
  }

  /**
   * Prepares list of tabs for tab-container.
   * @param tabsData
   * @returns {void|*}
   */
  handleActiveTabs(tabsData) {
    if (!tabsData.length) {
      return this.setState({ hasActiveTabs: false });
    }

    const panes = tabsData.map((item) => {
      let menuItemText = item.data.name;

      if (item.type === 'tickets') {
        menuItemText = item.data.original_subject;
      }

      return {
        menuItem: (
          <Menu.Item key={menuItemText}>
            {menuItemText}
            <Label
              className="icon-close"
              onClick={() => actions.removeTab(item.data.id)}
              circular
              size="mini"
            >X
            </Label>
          </Menu.Item>
        ),
        render: () => this.getTabContentByType(item.type, item.data),
      };
    });

    this.setState({ hasActiveTabs: true, panes });
  }

  render() {
    const { panes, hasActiveTabs } = this.state;

    if (!hasActiveTabs) {
      return <TabListStub />;
    }

    return (
      <div className="pt-2vh">
        <Tab panes={panes} />
      </div>
    );
  }
}

export default connect(({ activeTabs }) => ({ activeTabs }))(TabList);
