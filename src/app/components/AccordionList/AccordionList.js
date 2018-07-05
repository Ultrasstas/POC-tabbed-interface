import React from 'react';
import { Accordion, Icon } from 'semantic-ui-react';
import { connect } from '../../store';
import VerticalSegmentList from '../VerticalSegmentList/VerticalSegmentList';

import './AccordionList.scss';

class AccordionList extends React.Component {
  constructor(props) {
    super(props);

    this.handleClick = this.handleClick.bind(this);
    this.state = {
      activeIndex: -1,
    };
  }

  /**
   * Toggles accordion items.
   * @param e
   * @param titleProps
   */
  handleClick(e, titleProps) {
    const { index } = titleProps;
    const { activeIndex } = this.state;
    const newIndex = activeIndex === index ? -1 : index;

    this.setState({ activeIndex: newIndex });
  }

  render() {
    const { activeIndex } = this.state;
    const { users, organizations, tickets } = this.props;

    return (
      <div className="list-container">
        <Accordion styled>
          <Accordion.Title active={activeIndex === 0} index={0} onClick={this.handleClick}>
            <Icon name="dropdown" />
            Users
          </Accordion.Title>
          <Accordion.Content active={activeIndex === 0}>
            <VerticalSegmentList
              data={users}
              type="people"
              labelField="display_contact"
              onClickItem={this.props.onClickItem}
            />
          </Accordion.Content>

          <Accordion.Title active={activeIndex === 1} index={1} onClick={this.handleClick}>
            <Icon name="dropdown" />
            Organizations
          </Accordion.Title>
          <Accordion.Content active={activeIndex === 1}>
            <VerticalSegmentList
              data={organizations}
              type="organizations"
              labelField="name"
              onClickItem={this.props.onClickItem}
            />
          </Accordion.Content>

          <Accordion.Title active={activeIndex === 2} index={2} onClick={this.handleClick}>
            <Icon name="dropdown" />
            Tickets
          </Accordion.Title>
          <Accordion.Content active={activeIndex === 2}>
            <VerticalSegmentList
              data={tickets}
              type="tickets"
              labelField="subject"
              onClickItem={this.props.onClickItem}
            />
          </Accordion.Content>
        </Accordion>
      </div>
    );
  }
}

export default connect(({ users, organizations, tickets }) => ({
  users,
  organizations,
  tickets,
}))(AccordionList);
